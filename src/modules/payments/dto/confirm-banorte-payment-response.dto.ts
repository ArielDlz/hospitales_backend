import { ApiProperty } from '@nestjs/swagger';

export class ConfirmBanortePaymentResponseDto {
  @ApiProperty({ example: true })
  paid: boolean;

  @ApiProperty({
    example: 3,
    description: 'order_id del paso actual tras confirmar (Pagado = 3)',
  })
  evaluationFlowOrderId: number;
}
