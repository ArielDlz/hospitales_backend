import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReplaceRondaEvaluadoresDto {
  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description:
      'Reemplaza la lista. Vacío permite a cualquier evaluador. Cada id debe existir y tener rol evaluador.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  usuarioIds!: string[];
}
