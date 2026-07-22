import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class UpdateEvaluadorSupervisorDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'UUID del evaluador supervisor (debe ser evaluador activo con firma). null para quitar supervisor.',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID('4')
  supervisorId!: string | null;
}
