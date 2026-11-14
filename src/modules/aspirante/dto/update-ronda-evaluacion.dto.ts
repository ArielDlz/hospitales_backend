import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateRondaEvaluacionDto {
  @ApiProperty({
    example: true,
    description:
      'false impide nuevos claims. No modifica la lista de evaluadores.',
  })
  @IsBoolean()
  puedeEvaluar!: boolean;
}
