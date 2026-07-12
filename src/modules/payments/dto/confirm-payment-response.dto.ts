import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPaymentResponseDto {
  @ApiProperty({ example: true })
  paid: boolean;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken: string;

  @ApiProperty({ example: '7d' })
  expiresIn: string;

  @ApiProperty({
    example: 3,
    description: 'order_id del paso actual tras el pago (Pagado)',
  })
  evaluationFlowOrderId: number;
}
