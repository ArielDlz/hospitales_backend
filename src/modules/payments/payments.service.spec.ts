import Stripe from 'stripe';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { Payment, PaymentProvider, PaymentStatus } from './entities/payment.entity';
import { Aspirante } from '../aspirante/aspirante.entity';
import { Hospital } from '../hospital/hospital.entity';
import { AuthService } from '../auth/auth.service';
import { EvaluationFlowService } from '../aspirante/evaluation-flow.service';
import type { JwtPayloadAspirante } from '../../common/interfaces/jwt-payload.interface';
import {
  MSG_ACCESO_AUN_NO_ABIERTO,
  MSG_ACCESO_FINALIZADO,
} from '../hospital/tenant-access-window';

const PAYMENT_AMOUNT_CENTS = 200_000;
const STRIPE_PRICE_ID = 'price_test';
const STRIPE_PRODUCT_ID = 'prod_test';
const PRODUCT_NAME = 'Evaluación psicométrica';
const PRODUCT_DESCRIPTION = 'Acceso al proceso de evaluación del aspirante';

const mockPaymentIntentsCreate = jest.fn();
const mockPaymentIntentsRetrieve = jest.fn();
const mockPaymentIntentsCancel = jest.fn();
const mockPricesRetrieve = jest.fn();
const mockCustomersCreate = jest.fn();
const mockCustomersUpdate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  class StripeInvalidRequestError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  }

  const StripeMock = jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockPaymentIntentsCreate,
      retrieve: mockPaymentIntentsRetrieve,
      cancel: mockPaymentIntentsCancel,
    },
    prices: {
      retrieve: mockPricesRetrieve,
    },
    customers: {
      create: mockCustomersCreate,
      update: mockCustomersUpdate,
    },
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }));

  StripeMock.errors = { StripeInvalidRequestError };

  return { __esModule: true, default: StripeMock };
});

describe('PaymentsService', () => {
  let service: PaymentsService;

  const aspiranteId = 'asp-uuid-1';
  const tenantId = 'tenant-uuid-1';
  const user: JwtPayloadAspirante = {
    sub: aspiranteId,
    type: 'aspirante',
    tenantId,
    slug: 'hospital-general',
    registro: 'REG-001',
    nombre: 'Juan Pérez',
    evaluationFlowOrderId: 2,
    evaluationFlowDescripcion: 'Registrado',
    paymentProvider: 'stripe',
  };

  const paymentRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => ({ id: 'pay-1', ...data })),
  };
  const aspiranteRepo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const hospitalRepo = {
    findOne: jest.fn(),
  };
  const authService = {
    issueAspiranteAccessToken: jest.fn().mockReturnValue({
      accessToken: 'jwt-token',
      expiresIn: '1d',
    }),
  };
  const evaluationFlowService = {
    advanceOneStepIfAt: jest.fn().mockResolvedValue({ advanced: true, newOrderId: 3 }),
  };
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_xxx',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_xxx',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        STRIPE_PRICE_ID,
        PRIMER_ACCESO_DOMAIN: 'arieldelao.dev',
        STRIPE_REQUEST_THREE_D_SECURE: 'challenge',
        STRIPE_BILLING_COUNTRY: 'MX',
      };
      return values[key];
    }),
  };

  const aspiranteAtPaymentStep = {
    id: aspiranteId,
    tenantId,
    email: 'juan@ejemplo.com',
    nombre: 'Juan',
    apellidos: 'Pérez',
    registroHospital: 'REG-001',
    stripeCustomerId: null as string | null,
    paymentLink: null as string | null,
    claimedAt: null as Date | null,
    evaluationFlowStep: { orderId: 2 },
  };

  const stripeCustomerMetadata = {
    aspiranteId,
    tenantId,
    tenantSlug: 'hospital-general',
    email: 'juan@ejemplo.com',
    nombre: 'Juan',
    apellidos: 'Pérez',
    registroHospital: 'REG-001',
  };

  const billingDefaults = {
    name: 'Juan Pérez',
    email: 'juan@ejemplo.com',
    phone: null,
    address: { country: 'MX' },
  };

  const stripeCatalog = {
    id: STRIPE_PRICE_ID,
    active: true,
    unit_amount: PAYMENT_AMOUNT_CENTS,
    currency: 'mxn',
    product: {
      id: STRIPE_PRODUCT_ID,
      name: PRODUCT_NAME,
      description: PRODUCT_DESCRIPTION,
      deleted: false,
    },
  };

  const paymentIntentCreatePayload = {
    amount: PAYMENT_AMOUNT_CENTS,
    currency: 'mxn',
    description: PRODUCT_NAME,
    customer: 'cus_test',
    receipt_email: 'juan@ejemplo.com',
    automatic_payment_methods: { enabled: true },
    payment_method_options: {
      card: {
        request_three_d_secure: 'challenge',
      },
    },
    metadata: {
      ...stripeCustomerMetadata,
      stripePriceId: STRIPE_PRICE_ID,
      stripeProductId: STRIPE_PRODUCT_ID,
    },
  };

  const intentResponseShape = {
    provider: 'stripe' as const,
    paymentLink: null,
    publishableKey: 'pk_test_xxx',
    returnUrl: 'https://hospital-general.arieldelao.dev/pago/exito',
    clientSecret: 'pi_test_secret',
    paymentIntentId: 'pi_test',
    amountCents: PAYMENT_AMOUNT_CENTS,
    currency: 'mxn',
    productName: PRODUCT_NAME,
    productDescription: PRODUCT_DESCRIPTION,
    stripePriceId: STRIPE_PRICE_ID,
    status: 'requires_payment_method',
    requestThreeDSecure: 'challenge' as const,
    billingDefaults,
  };

  const reusableIntentMetadata = {
    stripePriceId: STRIPE_PRICE_ID,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPricesRetrieve.mockResolvedValue(stripeCatalog);
    mockCustomersCreate.mockResolvedValue({ id: 'cus_test' });
    mockCustomersUpdate.mockResolvedValue({ id: 'cus_existing' });
    hospitalRepo.findOne.mockResolvedValue({
      slug: 'hospital-general',
      accesoAbreAt: null,
      accesoCierraAt: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: configService },
        { provide: AuthService, useValue: authService },
        { provide: EvaluationFlowService, useValue: evaluationFlowService },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Aspirante), useValue: aspiranteRepo },
        { provide: getRepositoryToken(Hospital), useValue: hospitalRepo },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('createPaymentIntent', () => {
    it('rechaza si el aspirante no está en el paso 2', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        tenantId,
        evaluationFlowStep: { orderId: 3 },
      });

      await expect(service.createPaymentIntent(user)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it('crea PaymentIntent desde Stripe Price y Stripe Customer', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      paymentRepo.findOne.mockResolvedValue(null);
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test',
        client_secret: 'pi_test_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
      });

      const result = await service.createPaymentIntent(user);

      expect(mockPricesRetrieve).toHaveBeenCalledWith(STRIPE_PRICE_ID, {
        expand: ['product'],
      });
      expect(mockCustomersCreate).toHaveBeenCalledWith({
        email: 'juan@ejemplo.com',
        name: 'Juan Pérez',
        metadata: stripeCustomerMetadata,
      });
      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(paymentIntentCreatePayload);
      expect(aspiranteRepo.update).toHaveBeenCalledWith(
        { id: aspiranteId },
        { stripeCustomerId: 'cus_test' },
      );
      expect(result).toEqual(intentResponseShape);
    });

    it('reutiliza PaymentIntent existente si sigue siendo válido', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_existing',
      });
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_existing',
        client_secret: 'pi_existing_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
        metadata: reusableIntentMetadata,
        payment_method_options: {
          card: { request_three_d_secure: 'challenge' },
        },
      });

      const result = await service.createPaymentIntent(user);

      expect(mockPaymentIntentsRetrieve).toHaveBeenCalledWith('pi_existing');
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
      expect(result.paymentIntentId).toBe('pi_existing');
      expect(result.status).toBe('requires_payment_method');
      expect(result.productName).toBe(PRODUCT_NAME);
    });

    it('reutiliza PaymentIntent en processing sin cancelar', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_processing',
      });
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_processing',
        client_secret: 'pi_processing_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'processing',
        metadata: reusableIntentMetadata,
        payment_method_options: {
          card: { request_three_d_secure: 'challenge' },
        },
      });

      const result = await service.createPaymentIntent(user);

      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
      expect(result.paymentIntentId).toBe('pi_processing');
      expect(result.status).toBe('processing');
    });

    it('crea uno nuevo si el PaymentIntent tiene configuración 3DS distinta', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_old_3ds',
      });
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_old_3ds',
        client_secret: 'pi_old_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
        metadata: reusableIntentMetadata,
        payment_method_options: {
          card: { request_three_d_secure: 'any' },
        },
      });
      mockPaymentIntentsCancel.mockResolvedValue({ id: 'pi_old_3ds', status: 'canceled' });
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_new',
        client_secret: 'pi_new_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
      });

      const result = await service.createPaymentIntent(user);

      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_old_3ds');
      expect(mockPaymentIntentsCreate).toHaveBeenCalled();
      expect(result.paymentIntentId).toBe('pi_new');
    });

    it('crea uno nuevo si el PaymentIntent usa un Stripe Price distinto', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_old_price',
      });
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_old_price',
        client_secret: 'pi_old_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
        metadata: { stripePriceId: 'price_old' },
        payment_method_options: {
          card: { request_three_d_secure: 'challenge' },
        },
      });
      mockPaymentIntentsCancel.mockResolvedValue({ id: 'pi_old_price', status: 'canceled' });
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_new',
        client_secret: 'pi_new_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
      });

      const result = await service.createPaymentIntent(user);

      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_old_price');
      expect(mockPaymentIntentsCreate).toHaveBeenCalled();
      expect(result.paymentIntentId).toBe('pi_new');
    });

    it('crea uno nuevo si el PaymentIntent guardado no existe en Stripe', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_missing',
      });
      mockPaymentIntentsRetrieve.mockRejectedValue(
        new Stripe.errors.StripeInvalidRequestError(
          "No such payment_intent: 'pi_missing'",
          'resource_missing',
        ),
      );
      mockPaymentIntentsCancel.mockResolvedValue({ id: 'pi_missing', status: 'canceled' });
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_new',
        client_secret: 'pi_new_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
      });

      const result = await service.createPaymentIntent(user);

      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_missing');
      expect(mockPaymentIntentsCreate).toHaveBeenCalled();
      expect(result.paymentIntentId).toBe('pi_new');
    });

    it('cancela y crea uno nuevo si el PaymentIntent está canceled', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_canceled',
      });
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_canceled',
        client_secret: 'pi_canceled_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'canceled',
        metadata: reusableIntentMetadata,
        payment_method_options: {
          card: { request_three_d_secure: 'challenge' },
        },
      });
      mockPaymentIntentsCancel.mockResolvedValue({ id: 'pi_canceled', status: 'canceled' });
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_new',
        client_secret: 'pi_new_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
      });

      const result = await service.createPaymentIntent(user);

      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_canceled');
      expect(mockPaymentIntentsCreate).toHaveBeenCalled();
      expect(result.paymentIntentId).toBe('pi_new');
    });

    it('actualiza Stripe Customer existente en lugar de crear uno nuevo', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteAtPaymentStep,
        stripeCustomerId: 'cus_existing',
      });
      paymentRepo.findOne.mockResolvedValue(null);
      mockPaymentIntentsCreate.mockResolvedValue({
        id: 'pi_test',
        client_secret: 'pi_test_secret',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        status: 'requires_payment_method',
      });

      await service.createPaymentIntent(user);

      expect(mockCustomersUpdate).toHaveBeenCalledWith('cus_existing', {
        email: 'juan@ejemplo.com',
        name: 'Juan Pérez',
        metadata: stripeCustomerMetadata,
      });
      expect(mockCustomersCreate).not.toHaveBeenCalled();
    });

    it('rechaza si ya existe pago pagado', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Paid,
      });

      await expect(service.createPaymentIntent(user)).rejects.toThrow(
        ConflictException,
      );
    });

    it('tras cierre cancela PaymentIntent impago y responde 403', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      const existing = {
        id: 'pay-1',
        aspiranteId,
        tenantId,
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_open',
      };
      paymentRepo.findOne.mockResolvedValue(existing);
      hospitalRepo.findOne.mockResolvedValue({
        accesoCierraAt: new Date(Date.now() - 60_000),
      });
      mockPaymentIntentsCancel.mockResolvedValue({
        id: 'pi_open',
        status: 'canceled',
      });

      await expect(service.createPaymentIntent(user)).rejects.toThrow(
        MSG_ACCESO_FINALIZADO,
      );
      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_open');
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.Canceled }),
      );
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it('antes de abrir responde 403 y no cancela PaymentIntent existente', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      const existing = {
        id: 'pay-1',
        aspiranteId,
        tenantId,
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_open',
      };
      paymentRepo.findOne.mockResolvedValue(existing);
      hospitalRepo.findOne.mockResolvedValue({
        accesoAbreAt: new Date(Date.now() + 60_000),
        accesoCierraAt: null,
      });

      await expect(service.createPaymentIntent(user)).rejects.toThrow(
        MSG_ACCESO_AUN_NO_ABIERTO,
      );
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it('con payment_link devuelve payload Banorte y no crea PaymentIntent', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteAtPaymentStep,
        paymentLink: 'https://banorte.example/pay',
      });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_existing',
      });

      const result = await service.createPaymentIntent(user);

      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
      expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
      expect(result).toEqual({
        provider: 'banorte',
        paymentLink: 'https://banorte.example/pay',
        publishableKey: null,
        returnUrl: null,
        clientSecret: null,
        paymentIntentId: null,
        amountCents: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        productName: PRODUCT_NAME,
        productDescription: PRODUCT_DESCRIPTION,
        stripePriceId: null,
        status: null,
        requestThreeDSecure: null,
        billingDefaults: null,
      });
    });
  });

  describe('handleWebhook', () => {
    it('marca pagado y avanza 2→3 en payment_intent.succeeded', async () => {
      const intent = {
        id: 'pi_test',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        metadata: { aspiranteId, tenantId },
      };
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: intent },
      });
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        aspiranteId,
        tenantId,
        status: PaymentStatus.Pending,
      });

      await service.handleWebhook(Buffer.from('{}'), 'sig_test');

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.Paid,
          stripePaymentIntentId: 'pi_test',
          amountCents: PAYMENT_AMOUNT_CENTS,
          currency: 'mxn',
        }),
      );
      expect(evaluationFlowService.advanceOneStepIfAt).toHaveBeenCalledWith(
        aspiranteId,
        2,
        'payments:webhook_succeeded',
      );
    });

    it('es idempotente si el pago ya estaba pagado', async () => {
      const intent = {
        id: 'pi_test',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        metadata: { aspiranteId, tenantId },
      };
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: intent },
      });
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        aspiranteId,
        tenantId,
        status: PaymentStatus.Paid,
      });

      await service.handleWebhook(Buffer.from('{}'), 'sig_test');

      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(evaluationFlowService.advanceOneStepIfAt).toHaveBeenCalledWith(
        aspiranteId,
        2,
        'payments:ensurePaidOrSync',
      );
    });
  });

  describe('confirmPayment', () => {
    it('rechaza si el pago requiere acción 3DS', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_test',
        status: 'requires_action',
        metadata: { aspiranteId, tenantId },
      });
      paymentRepo.findOne.mockResolvedValue(null);
      hospitalRepo.findOne.mockResolvedValue({ accesoCierraAt: null });

      await expect(service.confirmPayment(user, 'pi_test')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza confirm Stripe si el aspirante tiene liga Banorte', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteAtPaymentStep,
        paymentLink: 'https://banorte.example/pay',
      });

      await expect(service.confirmPayment(user, 'pi_test')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPaymentIntentsRetrieve).not.toHaveBeenCalled();
    });

    it('tras cierre rechaza confirm no succeeded y cancela intent impago', async () => {
      aspiranteRepo.findOne.mockResolvedValue({ ...aspiranteAtPaymentStep });
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_open',
        status: 'requires_payment_method',
        metadata: { aspiranteId, tenantId },
      });
      const existing = {
        id: 'pay-1',
        aspiranteId,
        tenantId,
        status: PaymentStatus.Pending,
        stripePaymentIntentId: 'pi_open',
      };
      paymentRepo.findOne.mockResolvedValue(existing);
      hospitalRepo.findOne.mockResolvedValue({
        accesoCierraAt: new Date(Date.now() - 60_000),
      });
      mockPaymentIntentsCancel.mockResolvedValue({
        id: 'pi_open',
        status: 'canceled',
      });

      await expect(service.confirmPayment(user, 'pi_open')).rejects.toThrow(
        MSG_ACCESO_FINALIZADO,
      );
      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith('pi_open');
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.Canceled }),
      );
    });

    it('devuelve JWT cuando el pago fue exitoso', async () => {
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_test',
        status: 'succeeded',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        metadata: { aspiranteId, tenantId },
      });
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        aspiranteId,
        tenantId,
        status: PaymentStatus.Pending,
      });
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        tenantId,
        nombre: 'Juan',
        apellidos: 'Pérez',
        registroHospital: 'REG-001',
        paymentLink: null,
        evaluationFlowStep: { orderId: 3, descripcion: 'Pagado' },
      });
      hospitalRepo.findOne.mockResolvedValue({
        slug: 'hospital-general',
        accesoCierraAt: null,
      });

      const result = await service.confirmPayment(user, 'pi_test');

      expect(result).toEqual({
        paid: true,
        accessToken: 'jwt-token',
        expiresIn: '1d',
        evaluationFlowOrderId: 3,
      });
      expect(authService.issueAspiranteAccessToken).toHaveBeenCalled();
    });

    it('honra confirm succeeded aunque el tenant ya cerró', async () => {
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_late',
        status: 'succeeded',
        amount: PAYMENT_AMOUNT_CENTS,
        currency: 'mxn',
        metadata: { aspiranteId, tenantId },
      });
      paymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        aspiranteId,
        tenantId,
        status: PaymentStatus.Pending,
      });
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        tenantId,
        nombre: 'Juan',
        apellidos: 'Pérez',
        registroHospital: 'REG-001',
        paymentLink: null,
        evaluationFlowStep: { orderId: 3, descripcion: 'Pagado' },
      });
      hospitalRepo.findOne.mockResolvedValue({
        slug: 'hospital-general',
        accesoCierraAt: new Date(Date.now() - 60_000),
      });

      const result = await service.confirmPayment(user, 'pi_late');

      expect(result.paid).toBe(true);
      expect(evaluationFlowService.advanceOneStepIfAt).toHaveBeenCalled();
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
    });
  });

  describe('claimPayment', () => {
    it('guarda claimed_at y no avanza el flujo', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteAtPaymentStep,
        paymentLink: 'https://banorte.example/pay',
        claimedAt: null,
      });
      paymentRepo.findOne.mockResolvedValue(null);

      const result = await service.claimPayment(user);

      expect(aspiranteRepo.update).toHaveBeenCalledWith(
        { id: aspiranteId },
        { claimedAt: expect.any(Date) },
      );
      expect(result.claimedAt).toBeInstanceOf(Date);
      expect(evaluationFlowService.advanceOneStepIfAt).not.toHaveBeenCalled();
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('segunda vez conserva el primer claimed_at', async () => {
      const firstClaim = new Date('2026-09-01T00:00:00.000Z');
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteAtPaymentStep,
        paymentLink: 'https://banorte.example/pay',
        claimedAt: firstClaim,
      });
      paymentRepo.findOne.mockResolvedValue(null);

      const result = await service.claimPayment(user);

      expect(aspiranteRepo.update).not.toHaveBeenCalled();
      expect(result.claimedAt).toBe(firstClaim);
    });

    it('409 si el pago ya estaba pagado', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteAtPaymentStep,
        paymentLink: 'https://banorte.example/pay',
      });
      paymentRepo.findOne.mockResolvedValue({ status: PaymentStatus.Paid });

      await expect(service.claimPayment(user)).rejects.toThrow(ConflictException);
    });
  });

  describe('confirmBanortePayment', () => {
    const banorteAspirante = {
      ...aspiranteAtPaymentStep,
      paymentLink: 'https://banorte.example/pay',
    };

    it('marca pagado, provider banorte y avanza 2→3', async () => {
      aspiranteRepo.findOne
        .mockResolvedValueOnce(banorteAspirante)
        .mockResolvedValueOnce({
          ...banorteAspirante,
          evaluationFlowStep: { orderId: 3 },
        });
      paymentRepo.findOne.mockResolvedValue(null);

      const result = await service.confirmBanortePayment(aspiranteId);

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.Paid,
          provider: PaymentProvider.Banorte,
          amountCents: PAYMENT_AMOUNT_CENTS,
          currency: 'mxn',
        }),
      );
      expect(evaluationFlowService.advanceOneStepIfAt).toHaveBeenCalledWith(
        aspiranteId,
        2,
        'payments:banorte_admin',
      );
      expect(result).toEqual({ paid: true, evaluationFlowOrderId: 3 });
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });

    it('rechaza si no hay payment_link', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteAtPaymentStep,
        paymentLink: null,
      });

      await expect(service.confirmBanortePayment(aspiranteId)).rejects.toThrow(
        BadRequestException,
      );
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('404 si el aspirante no existe', async () => {
      aspiranteRepo.findOne.mockResolvedValue(null);

      await expect(service.confirmBanortePayment(aspiranteId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('es idempotente si el pago ya estaba pagado', async () => {
      aspiranteRepo.findOne
        .mockResolvedValueOnce(banorteAspirante)
        .mockResolvedValueOnce({
          ...banorteAspirante,
          evaluationFlowStep: { orderId: 3 },
        });
      paymentRepo.findOne.mockResolvedValue({
        status: PaymentStatus.Paid,
        provider: PaymentProvider.Banorte,
      });

      const result = await service.confirmBanortePayment(aspiranteId);

      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(evaluationFlowService.advanceOneStepIfAt).toHaveBeenCalledWith(
        aspiranteId,
        2,
        'payments:banorte_admin',
      );
      expect(result).toEqual({ paid: true, evaluationFlowOrderId: 3 });
    });
  });
});
