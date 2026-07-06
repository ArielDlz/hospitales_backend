import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PruebaRespuestaDisplayDto {
  @ApiProperty({ example: 101 })
  idPruebaRespuesta: number;

  @ApiProperty({ example: 3 })
  idPregunta: number;

  @ApiProperty({ example: 'texto_libre' })
  tipo: string;

  @ApiProperty({
    description:
      'Texto, URL, etiqueta(s) de opción o IDs según resolveOptionLabels',
  })
  respuesta: string | number | number[] | string[] | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
    description:
      'Solo preguntas con opciones (opcion_unica/opcion_multiple). null si no hay opción correcta configurada',
  })
  esCorrecta?: boolean | null;
}

export class PruebaRespuestasEnriquecidasDto {
  @ApiProperty({ example: 19 })
  idPruebaAspirante: number;

  @ApiProperty({ example: 5 })
  idPrueba: number;

  @ApiProperty({ type: [PruebaRespuestaDisplayDto] })
  respuestas: PruebaRespuestaDisplayDto[];
}
