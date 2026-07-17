import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { Aspirante } from '../aspirante/aspirante.entity';
import { EvaluationFlowService } from '../aspirante/evaluation-flow.service';
import { AuthService } from '../auth/auth.service';
import { Hospital } from '../hospital/hospital.entity';
import { JwtPayloadAspirante } from '../../common/interfaces/jwt-payload.interface';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { ConfirmPaymentResponseDto } from './dto/confirm-payment-response.dto';
import { CreatePaymentIntentResponseDto } from './dto/create-payment-intent-response.dto';
import type { StripeThreeDSecureRequest } from './dto/create-payment-intent-response.dto';
import { PaymentBillingDefaultsDto } from './dto/payment-billing-defaults.dto';

export const PAYMENT_BILLING_COUNTRY = 'MX';

type ResolvedStripeCatalog = {
  priceId: string;
  productId: string;
  amountCents: number;
  currency: string;
  productName: string;
  productDescription: string | null;
};

const REUSABLE_INTENT_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
]);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private cachedStripeCatalog: ResolvedStripeCatalog | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly evaluationFlowService: EvaluationFlowService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new InternalServerErrorException('STRIPE_SECRET_KEY no configurada');
    }
    this.stripe = new Stripe(secretKey);
  }

  async createPaymentIntent(
    user: JwtPayloadAspirante,
  ): Promise<CreatePaymentIntentResponseDto> {
    const aspirante = await this.loadAspiranteAtPaymentStep(user.sub);

    const existing = await this.paymentRepository.findOne({
      where: { tenantId: user.tenantId, aspiranteId: user.sub },
    });

    if (existing?.status === PaymentStatus.Paid) {
      throw new ConflictException('Este aspirante ya completó el pago');
    }

    if (existing?.stripePaymentIntentId) {
      const reused = await this.tryReuseExistingPaymentIntent(
        existing,
        aspirante,
        user.slug,
      );
      if (reused) {
        return reused;
      }
      await this.cancelPaymentIntentIfPossible(existing.stripePaymentIntentId);
    }

    return this.createAndStorePaymentIntent(aspirante, user.slug);
  }

  async confirmPayment(
    user: JwtPayloadAspirante,
    paymentIntentId: string,
  ): Promise<ConfirmPaymentResponseDto> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.metadata.aspiranteId !== user.sub) {
      throw new BadRequestException('El pago no corresponde a este aspirante');
    }
    if (intent.metadata.tenantId !== user.tenantId) {
      throw new BadRequestException('El pago no corresponde a este hospital');
    }
    if (intent.status === 'requires_action') {
      throw new BadRequestException(
        'Debes completar la autenticación 3D Secure antes de confirmar el pago',
      );
    }
    if (intent.status === 'processing') {
      throw new BadRequestException(
        'El pago está en proceso; intenta confirmar de nuevo en unos segundos',
      );
    }
    if (intent.status !== 'succeeded') {
      throw new BadRequestException('El pago aún no se ha completado');
    }

    let payment = await this.paymentRepository.findOne({
      where: { tenantId: user.tenantId, aspiranteId: user.sub },
    });

    if (!payment) {
      payment = this.paymentRepository.create({
        tenantId: user.tenantId,
        aspiranteId: user.sub,
        stripePaymentIntentId: intent.id,
        amountCents: intent.amount,
        currency: intent.currency,
        status: PaymentStatus.Pending,
        paidAt: null,
      });
    }

    if (payment.status !== PaymentStatus.Paid) {
      await this.markPaymentSucceeded(
        payment,
        intent.id,
        intent.amount,
        intent.currency,
      );
    } else {
      await this.evaluationFlowService.advanceOneStepIfAt(
        user.sub,
        2,
        'payments:confirm',
      );
    }

    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: user.sub },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante?.evaluationFlowStep) {
      throw new InternalServerErrorException('Aspirante sin paso de flujo asignado');
    }

    const hospital = await this.hospitalRepository.findOne({
      where: { uuid: aspirante.tenantId, active: true },
      select: ['slug', 'accesoCierraAt'],
    });
    if (!hospital) {
      throw new InternalServerErrorException('Hospital no encontrado');
    }

    const tokenBundle = this.authService.issueAspiranteAccessToken({
      aspirante,
      hospitalSlug: hospital.slug,
      accesoCierraAt: hospital.accesoCierraAt,
      flowStep: aspirante.evaluationFlowStep,
    });

    return {
      paid: true,
      ...tokenBundle,
      evaluationFlowOrderId: aspirante.evaluationFlowStep.orderId,
    };
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET no configurada');
    }
    if (!signature) {
      throw new BadRequestException('Falta cabecera Stripe-Signature');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Webhook Stripe rechazado: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.processPaymentIntentSucceeded(intent);
      return;
    }

    this.logger.debug(`Webhook Stripe ignorado: ${event.type}`);
  }

  private async processPaymentIntentSucceeded(
    intent: Stripe.PaymentIntent,
  ): Promise<void> {
    const aspiranteId = intent.metadata.aspiranteId;
    const tenantId = intent.metadata.tenantId;
    if (!aspiranteId || !tenantId) {
      this.logger.warn(
        `payment_intent.succeeded sin metadata (intent=${intent.id})`,
      );
      return;
    }

    let payment = await this.paymentRepository.findOne({
      where: { tenantId, aspiranteId },
    });

    if (!payment) {
      payment = this.paymentRepository.create({
        tenantId,
        aspiranteId,
        stripePaymentIntentId: intent.id,
        amountCents: intent.amount,
        currency: intent.currency,
        status: PaymentStatus.Pending,
        paidAt: null,
      });
    }

    if (payment.status === PaymentStatus.Paid) {
      await this.evaluationFlowService.advanceOneStepIfAt(
        aspiranteId,
        2,
        'payments:ensurePaidOrSync',
      );
      return;
    }

    await this.markPaymentSucceeded(
      payment,
      intent.id,
      intent.amount,
      intent.currency,
    );
    this.logger.log(
      `Pago confirmado aspirante=${aspiranteId} intent=${intent.id}`,
    );
  }

  private async markPaymentSucceeded(
    payment: Payment,
    stripePaymentIntentId: string,
    amountCents: number,
    currency: string,
  ): Promise<void> {
    payment.stripePaymentIntentId = stripePaymentIntentId;
    payment.amountCents = amountCents;
    payment.currency = currency;
    payment.status = PaymentStatus.Paid;
    payment.paidAt = new Date();
    await this.paymentRepository.save(payment);
    if (payment.aspiranteId) {
      await this.evaluationFlowService.advanceOneStepIfAt(
        payment.aspiranteId,
        2,
        'payments:webhook_succeeded',
      );
    }
  }

  private async tryReuseExistingPaymentIntent(
    payment: Payment,
    aspirante: Aspirante,
    slug: string,
  ): Promise<CreatePaymentIntentResponseDto | null> {
    const stripePaymentIntentId = payment.stripePaymentIntentId;
    if (!stripePaymentIntentId) {
      return null;
    }

    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.retrieve(stripePaymentIntentId);
    } catch (err) {
      if (this.isStripeResourceMissingError(err)) {
        this.logger.warn(
          `PaymentIntent no encontrado en Stripe (intent=${stripePaymentIntentId}), se creará uno nuevo`,
        );
        return null;
      }
      throw err;
    }

    if (intent.status === 'succeeded') {
      await this.markPaymentSucceeded(
        payment,
        intent.id,
        intent.amount,
        intent.currency,
      );
      throw new ConflictException('El pago ya fue procesado');
    }

    if (!this.intentMatchesPaymentConfig(intent)) {
      this.logger.debug(
        `PaymentIntent con configuración 3DS distinta (intent=${intent.id}), se creará uno nuevo`,
      );
      return null;
    }

    if (REUSABLE_INTENT_STATUSES.has(intent.status) && intent.client_secret) {
      return await this.toIntentResponse(intent, slug, aspirante);
    }

    this.logger.debug(
      `PaymentIntent no reutilizable (intent=${intent.id}, status=${intent.status}), se creará uno nuevo`,
    );
    return null;
  }

  private async cancelPaymentIntentIfPossible(
    stripePaymentIntentId: string,
  ): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(stripePaymentIntentId);
    } catch (err) {
      if (this.isStripeResourceMissingError(err)) {
        return;
      }
      this.logger.debug(
        `No se pudo cancelar PaymentIntent ${stripePaymentIntentId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private isStripeResourceMissingError(err: unknown): boolean {
    return (
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === 'resource_missing'
    );
  }

  private async createAndStorePaymentIntent(
    aspirante: Aspirante,
    slug: string,
  ): Promise<CreatePaymentIntentResponseDto> {
    const stripeCustomerId = await this.resolveOrCreateStripeCustomer(aspirante, slug);
    const catalog = await this.loadStripeCatalog();

    const intent = await this.stripe.paymentIntents.create(
      this.buildPaymentIntentCreateParams(aspirante, slug, stripeCustomerId, catalog),
    );

    if (!intent.client_secret) {
      throw new InternalServerErrorException(
        'Stripe no devolvió client_secret para el PaymentIntent',
      );
    }

    await this.upsertPendingPayment(aspirante, intent.id, catalog);

    return await this.toIntentResponse(intent, slug, aspirante);
  }

  private async upsertPendingPayment(
    aspirante: Aspirante,
    stripePaymentIntentId: string,
    catalog: ResolvedStripeCatalog,
  ): Promise<void> {
    const existing = await this.paymentRepository.findOne({
      where: { tenantId: aspirante.tenantId, aspiranteId: aspirante.id },
    });

    if (existing) {
      existing.stripePaymentIntentId = stripePaymentIntentId;
      existing.amountCents = catalog.amountCents;
      existing.currency = catalog.currency;
      existing.status = PaymentStatus.Pending;
      existing.paidAt = null;
      await this.paymentRepository.save(existing);
      return;
    }

    await this.paymentRepository.save(
      this.paymentRepository.create({
        tenantId: aspirante.tenantId,
        aspiranteId: aspirante.id,
        stripePaymentIntentId,
        amountCents: catalog.amountCents,
        currency: catalog.currency,
        status: PaymentStatus.Pending,
        paidAt: null,
      }),
    );
  }

  private async loadAspiranteAtPaymentStep(aspiranteId: string): Promise<Aspirante> {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: aspiranteId, active: true },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante?.evaluationFlowStep) {
      throw new BadRequestException('Aspirante inválido o sin paso de flujo');
    }
    if (aspirante.evaluationFlowStep.orderId !== 2) {
      throw new BadRequestException(
        'El pago solo está disponible en el paso Registrado (order_id 2)',
      );
    }
    return aspirante;
  }

  private async toIntentResponse(
    intent: Stripe.PaymentIntent,
    slug: string,
    aspirante: Aspirante,
  ): Promise<CreatePaymentIntentResponseDto> {
    if (!intent.client_secret) {
      throw new InternalServerErrorException(
        'Stripe no devolvió client_secret para el PaymentIntent',
      );
    }
    const publishableKey = this.configService.get<string>('STRIPE_PUBLISHABLE_KEY');
    if (!publishableKey) {
      throw new InternalServerErrorException('STRIPE_PUBLISHABLE_KEY no configurada');
    }
    const catalog = await this.loadStripeCatalog();
    return {
      publishableKey,
      returnUrl: this.resolveReturnUrl(slug),
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents: intent.amount,
      currency: intent.currency,
      productName: catalog.productName,
      productDescription: catalog.productDescription,
      stripePriceId: catalog.priceId,
      status: intent.status,
      requestThreeDSecure: this.getRequestThreeDSecure(),
      billingDefaults: this.buildBillingDefaults(aspirante),
    };
  }

  private buildBillingDefaults(aspirante: Aspirante): PaymentBillingDefaultsDto {
    return {
      name: `${aspirante.nombre} ${aspirante.apellidos}`.trim(),
      email: aspirante.email,
      phone: aspirante.telefono?.trim() || null,
      address: {
        country: this.getBillingCountry(),
      },
    };
  }

  private getBillingCountry(): string {
    return (
      this.configService.get<string>('STRIPE_BILLING_COUNTRY')?.trim().toUpperCase() ||
      PAYMENT_BILLING_COUNTRY
    );
  }

  private getRequestThreeDSecure(): StripeThreeDSecureRequest {
    const value = this.configService
      .get<string>('STRIPE_REQUEST_THREE_D_SECURE', 'challenge')
      ?.trim()
      .toLowerCase();
    if (value === 'any') {
      return 'any';
    }
    return 'challenge';
  }

  private intentMatchesPaymentConfig(intent: Stripe.PaymentIntent): boolean {
    const configured = intent.payment_method_options?.card?.request_three_d_secure;
    if (configured !== this.getRequestThreeDSecure()) {
      return false;
    }
    return intent.metadata.stripePriceId === this.getStripePriceId();
  }

  private getStripePriceId(): string {
    const priceId = this.configService.get<string>('STRIPE_PRICE_ID')?.trim();
    if (!priceId) {
      throw new InternalServerErrorException('STRIPE_PRICE_ID no configurada');
    }
    return priceId;
  }

  private async loadStripeCatalog(): Promise<ResolvedStripeCatalog> {
    const priceId = this.getStripePriceId();
    if (this.cachedStripeCatalog?.priceId === priceId) {
      return this.cachedStripeCatalog;
    }

    let price: Stripe.Price;
    try {
      price = await this.stripe.prices.retrieve(priceId, { expand: ['product'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`No se pudo obtener Stripe Price ${priceId}: ${message}`);
      throw new InternalServerErrorException(
        'No se pudo cargar el precio de pago desde Stripe',
      );
    }

    if (!price.active) {
      throw new InternalServerErrorException('El precio de pago en Stripe no está activo');
    }
    if (price.unit_amount == null) {
      throw new InternalServerErrorException(
        'El precio de pago en Stripe no tiene monto fijo (unit_amount)',
      );
    }

    const product =
      typeof price.product === 'string'
        ? null
        : (price.product as Stripe.Product | null);
    if (!product || product.deleted) {
      throw new InternalServerErrorException(
        'No se pudo cargar el producto asociado al precio de pago en Stripe',
      );
    }

    this.cachedStripeCatalog = {
      priceId: price.id,
      productId: product.id,
      amountCents: price.unit_amount,
      currency: price.currency,
      productName: product.name,
      productDescription: product.description ?? null,
    };

    return this.cachedStripeCatalog;
  }

  private buildPaymentIntentCreateParams(
    aspirante: Aspirante,
    tenantSlug: string,
    stripeCustomerId: string,
    catalog: ResolvedStripeCatalog,
  ): Stripe.PaymentIntentCreateParams {
    const metadata = {
      ...this.buildPaymentIntentMetadata(aspirante, tenantSlug),
      stripePriceId: catalog.priceId,
      stripeProductId: catalog.productId,
    };
    return {
      amount: catalog.amountCents,
      currency: catalog.currency,
      description: catalog.productName,
      customer: stripeCustomerId,
      receipt_email: aspirante.email,
      automatic_payment_methods: { enabled: true },
      payment_method_options: {
        card: {
          request_three_d_secure: this.getRequestThreeDSecure(),
        },
      },
      metadata,
    };
  }

  private resolveReturnUrl(slug: string): string {
    const domain = this.configService.get<string>('PRIMER_ACCESO_DOMAIN')?.trim();
    if (domain) {
      return `https://${slug}.${domain}/pago/exito`;
    }
    return `https://${slug}.localhost/pago/exito`;
  }

  private buildPaymentIntentMetadata(
    aspirante: Aspirante,
    tenantSlug: string,
  ): Record<string, string> {
    return {
      aspiranteId: aspirante.id,
      tenantId: aspirante.tenantId,
      tenantSlug,
      email: aspirante.email,
      nombre: aspirante.nombre,
      apellidos: aspirante.apellidos,
      registroHospital: aspirante.registroHospital,
    };
  }

  private buildStripeCustomerPayload(
    aspirante: Aspirante,
    tenantSlug: string,
  ): Stripe.CustomerCreateParams {
    const phone = aspirante.telefono?.trim();
    return {
      email: aspirante.email,
      name: `${aspirante.nombre} ${aspirante.apellidos}`.trim(),
      ...(phone ? { phone } : {}),
      metadata: this.buildPaymentIntentMetadata(aspirante, tenantSlug),
    };
  }

  private async resolveOrCreateStripeCustomer(
    aspirante: Aspirante,
    tenantSlug: string,
  ): Promise<string> {
    const payload = this.buildStripeCustomerPayload(aspirante, tenantSlug);

    if (aspirante.stripeCustomerId) {
      try {
        await this.stripe.customers.update(aspirante.stripeCustomerId, payload);
        return aspirante.stripeCustomerId;
      } catch (err) {
        if (!this.isStripeResourceMissingError(err)) {
          throw err;
        }
        this.logger.warn(
          `Stripe Customer no encontrado (customer=${aspirante.stripeCustomerId}), se creará uno nuevo`,
        );
      }
    }

    const customer = await this.stripe.customers.create(payload);
    aspirante.stripeCustomerId = customer.id;
    await this.aspiranteRepository.update(
      { id: aspirante.id },
      { stripeCustomerId: customer.id },
    );

    return customer.id;
  }
}
