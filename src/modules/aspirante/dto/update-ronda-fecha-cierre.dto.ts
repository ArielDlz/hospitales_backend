import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsDefined, ValidateIf } from 'class-validator';

export class UpdateRondaFechaCierreDto {
  @ApiProperty({
    nullable: true,
    example: '2026-12-01T06:00:00.000Z',
    description:
      'Fin de acceso de la ronda (ISO-8601). Null deja la ronda abierta. Una fecha futura sigue abierta hasta ese instante.',
  })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  fechaCierre!: string | null;
}
