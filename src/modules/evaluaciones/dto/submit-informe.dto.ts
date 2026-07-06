import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class SubmitInformeDto {
  @ApiProperty({
    example: 'Informe final: el aspirante cumple con los requisitos generales.',
    description: 'Comentario final del evaluador sobre el aspirante',
  })
  @IsString()
  @IsNotEmpty()
  comentario: string;

  @ApiProperty({
    example: 1,
    description: 'ID del veredicto (catálogo veredictos)',
  })
  @IsInt()
  @Min(1)
  idVeredicto: number;
}
