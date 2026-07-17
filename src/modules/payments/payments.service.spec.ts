import Stripe from 'stripe';
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Aspirante } from '../aspirante/aspirante.entity';
import { Hospital } from '../hospital/hospital.entity';
import { AuthService } from '../auth/auth.service';
import { EvaluationFlowService } from '../aspirante/evaluation-flow.service';
import type { JwtPayloadAspirante } from '../../common/interfaces/jwt-payload.interface';

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
      mockPaymentIntentsRetrieve.mockResolvedValue({
        id: 'pi_test',
        status: 'requires_action',
        metadata: { aspiranteId, tenantId },
      });

      await expect(service.confirmPayment(user, 'pi_test')).rejects.toThrow(
        BadRequestException,
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
        evaluationFlowStep: { orderId: 3, descripcion: 'Pagado' },
      });
      hospitalRepo.findOne.mockResolvedValue({ slug: 'hospital-general' });

      const result = await service.confirmPayment(user, 'pi_test');

      expect(result).toEqual({
        paid: true,
        accessToken: 'jwt-token',
        expiresIn: '1d',
        evaluationFlowOrderId: 3,
      });
      expect(authService.issueAspiranteAccessToken).toHaveBeenCalled();
    });
  });
});
