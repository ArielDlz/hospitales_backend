import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FlowNavigationReason = 'END_OF_FLOW' | 'AT_BEGINNING';

export class FlowStepNavigationResponseDto {
  @ApiProperty({
    description:
      'Si es true, el aspirante avanzó/retrocedió y se devuelve un nuevo accessToken',
  })
  flowUpdated: boolean;

  @ApiPropertyOptional({
    enum: ['END_OF_FLOW', 'AT_BEGINNING'],
    description:
      'END_OF_FLOW: no hay paso con order_id+1. AT_BEGINNING: no se puede bajar de order_id 1.',
  })
  reason?: FlowNavigationReason;

  @ApiPropertyOptional({ description: 'Nuevo JWT (solo si flowUpdated es true)' })
  accessToken?: string;

  @ApiPropertyOptional({ description: 'Expiración del token (solo si flowUpdated es true)' })
  expiresIn?: string;
}
