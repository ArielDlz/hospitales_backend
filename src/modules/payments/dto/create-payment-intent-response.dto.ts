import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentBillingDefaultsDto } from './payment-billing-defaults.dto';

export type StripeThreeDSecureRequest = 'any' | 'challenge';

export class CreatePaymentIntentResponseDto {
  @ApiProperty({
    example: 'pk_test_...',
    description: 'Clave publicable de Stripe para inicializar Stripe.js',
  })
  publishableKey: string;

  @ApiProperty({
    example: 'https://hospital-general.arieldelao.dev/pago/exito',
    description: 'URL de retorno por tenant (3D Secure / redirect)',
  })
  returnUrl: string;

  @ApiProperty({
    example: 'pi_xxx_secret_xxx',
    description: 'Client secret para montar Stripe Payment Element',
  })
  clientSecret: string;

  @ApiProperty({
    example: 'pi_xxx',
    description: 'ID del PaymentIntent en Stripe',
  })
  paymentIntentId: string;

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

  @ApiProperty({ example: 'price_1Tr8J4FByYNF9ILkI3Wv6a4i' })
  stripePriceId: string;

  @ApiProperty({
    example: 'requires_payment_method',
    description:
      'Estado del PaymentIntent en Stripe. Si es "processing", el frontend debe esperar/pollear sin crear un nuevo intent.',
  })
  status: string;

  @ApiProperty({
    enum: ['any', 'challenge'],
    example: 'challenge',
    description:
      'Debe pasarse a Payment Element como requestThreeDSecure; coincide con payment_method_options del PaymentIntent.',
  })
  requestThreeDSecure: StripeThreeDSecureRequest;

  @ApiProperty({
    type: PaymentBillingDefaultsDto,
    description:
      'Valores sugeridos para defaultValues.billingDetails en Payment Element (name, email, phone, address.country).',
  })
  billingDefaults: PaymentBillingDefaultsDto;
}
