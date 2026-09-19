import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentBillingDefaultsDto } from './payment-billing-defaults.dto';

export type StripeThreeDSecureRequest = 'any' | 'challenge';

export type PaymentIntentProvider = 'stripe' | 'banorte';

export class CreatePaymentIntentResponseDto {
  @ApiProperty({
    enum: ['stripe', 'banorte'],
    example: 'stripe',
    description:
      'Canal de cobro. stripe = Payment Element; banorte = abrir paymentLink. Se decide por payment_link del aspirante.',
  })
  provider: PaymentIntentProvider;

  @ApiPropertyOptional({
    example: 'https://ligasdepago.banorte.com/xyz',
    nullable: true,
    description: 'URL de liga Banorte. null si provider es stripe.',
  })
  paymentLink: string | null;

  @ApiPropertyOptional({
    example: 'pk_test_...',
    nullable: true,
    description: 'Clave publicable de Stripe. null si provider es banorte.',
  })
  publishableKey: string | null;

  @ApiPropertyOptional({
    example: 'https://hospital-general.arieldelao.dev/pago/exito',
    nullable: true,
    description: 'URL de retorno por tenant (3D Secure / redirect). null si Banorte.',
  })
  returnUrl: string | null;

  @ApiPropertyOptional({
    example: 'pi_xxx_secret_xxx',
    nullable: true,
    description: 'Client secret para montar Stripe Payment Element. null si Banorte.',
  })
  clientSecret: string | null;

  @ApiPropertyOptional({
    example: 'pi_xxx',
    nullable: true,
    description: 'ID del PaymentIntent en Stripe. null si Banorte.',
  })
  paymentIntentId: string | null;

  @ApiProperty({ example: 200000, description: 'Monto en centavos (2000 MXN)' })
  amountCents: number;

  @ApiProperty({ example: 'mxn' })
  currency: string;

  @ApiProperty({ example: 'Evaluación psicométrica' })
  productName: string;

  @ApiPropertyOptional({
    example: 'Acceso al proceso de evaluación del aspirante',
    nullable: true,
  })
  productDescription: string | null;

  @ApiPropertyOptional({
    example: 'price_1Tr8J4FByYNF9ILkI3Wv6a4i',
    nullable: true,
    description: 'Price ID de Stripe. null si Banorte.',
  })
  stripePriceId: string | null;

  @ApiPropertyOptional({
    example: 'requires_payment_method',
    nullable: true,
    description:
      'Estado del PaymentIntent en Stripe. Si es "processing", el frontend debe esperar/pollear sin crear un nuevo intent. null si Banorte.',
  })
  status: string | null;

  @ApiPropertyOptional({
    enum: ['any', 'challenge'],
    example: 'challenge',
    nullable: true,
    description:
      'Debe pasarse a Payment Element como requestThreeDSecure. null si Banorte.',
  })
  requestThreeDSecure: StripeThreeDSecureRequest | null;

  @ApiPropertyOptional({
    type: PaymentBillingDefaultsDto,
    nullable: true,
    description:
      'Valores sugeridos para defaultValues.billingDetails en Payment Element. null si Banorte.',
  })
  billingDefaults: PaymentBillingDefaultsDto | null;
}
