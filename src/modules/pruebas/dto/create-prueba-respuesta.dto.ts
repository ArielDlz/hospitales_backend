import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsInt, IsString, Min } from 'class-validator';

export class CreatePruebaRespuestaDto {
  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(1)
  id_prueba_aspirante: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  id_pregunta: number;

  @ApiProperty({
    example: 'texto_libre',
    description:
      'Tipo de pregunta enviado por frontend (texto_libre, texto_corto, opcion_unica, opcion_multiple, archivo, cargar_archivo)',
  })
  @IsString()
  tipo: string;

  @ApiProperty({
    description:
      'Valor de respuesta: string para texto/archivo, number para opcion_unica, number[] para opcion_multiple',
    example: 'Respuesta del aspirante',
  })
  @IsDefined()
  respuesta: unknown;
}
