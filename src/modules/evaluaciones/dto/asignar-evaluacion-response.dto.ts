import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AsignarEvaluacionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  aspiranteId: string;

  @ApiProperty({ example: 6 })
  evaluationFlowOrderId: number;

  @ApiProperty({ example: 'Evaluación en curso', nullable: true })
  evaluationFlowDescripcion: string | null;

  @ApiPropertyOptional({
    example: 'evaluador@hospital.com',
    nullable: true,
    description: 'Email del evaluador asignado (null para admin en solo lectura)',
  })
  evaluadorAsignadoEmail: string | null;

  @ApiProperty({
    example: false,
    description:
      'true si el usuario es administrador (sin asignación ni cambio de paso)',
  })
  readOnly: boolean;

  @ApiProperty({ example: 'Evaluación asignada correctamente' })
  message: string;
}
