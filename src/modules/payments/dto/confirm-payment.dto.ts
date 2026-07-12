import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({
    example: 'pi_xxx',
    description: 'ID del PaymentIntent devuelto por POST /payments/intent',
  })
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;
}
