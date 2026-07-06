import { ApiProperty } from '@nestjs/swagger';

export class FirmarInformeResponseDto {
  @ApiProperty({
    example:
      'https://bucket.s3.amazonaws.com/informes-firmados/REG-001 - Juan García - Hospital General.pdf',
  })
  veredictoInforme: string;

  @ApiProperty({ example: 'Informe firmado correctamente' })
  message: string;

  @ApiProperty({ example: 10, description: 'order_id del paso actual tras firmar' })
  evaluationFlowOrderId: number;
}
