import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentBillingAddressDefaultsDto {
  @ApiProperty({
    example: 'MX',
    description: 'País ISO 3166-1 alpha-2 para el código postal en Payment Element',
  })
  country: string;
}

export class PaymentBillingDefaultsDto {
  @ApiProperty({ example: 'Juan Pérez', description: 'Prefill de nombre del titular' })
  name: string;

  @ApiProperty({ example: 'juan@ejemplo.com' })
  email: string;

  @ApiPropertyOptional({ example: '+525551234567', nullable: true })
  phone: string | null;

  @ApiProperty({ type: PaymentBillingAddressDefaultsDto })
  address: PaymentBillingAddressDefaultsDto;
}
