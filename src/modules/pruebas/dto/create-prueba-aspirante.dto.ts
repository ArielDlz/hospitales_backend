import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class CreatePruebaAspiranteDto {
  @ApiProperty({
    example: 1,
    description: 'ID de la prueba que el aspirante iniciará',
  })
  @IsInt()
  @Min(1)
  id_prueba: number;
}
