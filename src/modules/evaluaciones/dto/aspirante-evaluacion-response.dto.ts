import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VeredictoResponseDto } from './veredicto-response.dto';

export class AspiranteEvaluacionResponseDto {
  @ApiProperty({ example: 'Informe final del evaluador.' })
  comentario: string;

  @ApiProperty({ type: VeredictoResponseDto })
  veredicto: VeredictoResponseDto;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Null si el informe aún no fue confirmado',
  })
  confirmedAt: Date | null;

  @ApiProperty({ example: '2025-05-31T12:00:00.000Z' })
  createdAt: Date;
}

export class ConfirmarEvaluacionResponseDto {
  @ApiProperty({ example: 'Evaluación confirmada correctamente' })
  message: string;

  @ApiProperty({ example: 7 })
  evaluationFlowOrderId: number;
}
