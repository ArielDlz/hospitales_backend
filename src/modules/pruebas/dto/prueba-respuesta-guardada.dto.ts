import { ApiProperty } from '@nestjs/swagger';

export class PruebaRespuestaGuardadaDto {
  @ApiProperty({ example: 101 })
  idPruebaRespuesta: number;

  @ApiProperty({ example: 3 })
  idPregunta: number;

  @ApiProperty({
    example: 'texto_libre',
    description:
      'Tipo de pregunta (texto_libre, texto_corto, opcion_unica, opcion_multiple, archivo, cargar_archivo)',
  })
  tipo: string;

  @ApiProperty({
    description:
      'Valor guardado: string (texto/archivo URL), number (opcion_unica), number[] (opcion_multiple)',
    example: 'Respuesta del aspirante',
  })
  respuesta: string | number | number[] | null;
}

export class PruebaRespuestasIntentoResponseDto {
  @ApiProperty({ example: 19 })
  idPruebaAspirante: number;

  @ApiProperty({ example: 5 })
  idPrueba: number;

  @ApiProperty({ type: [PruebaRespuestaGuardadaDto] })
  respuestas: PruebaRespuestaGuardadaDto[];
}
