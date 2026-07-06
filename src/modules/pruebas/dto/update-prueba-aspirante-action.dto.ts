import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdatePruebaAspiranteActionDto {
  @ApiProperty({
    example: 'finalizada por el aspirante',
    description:
      'Acción sobre la prueba del aspirante. Actualmente soportada: "finalizada por el aspirante".',
  })
  @IsString()
  action: string;
}
