import { ApiProperty } from '@nestjs/swagger';

export class PreguntaOpcionPublicDto {
  @ApiProperty({ example: 11 })
  idPreguntaOpcion: number;

  @ApiProperty({ example: 'Opción A' })
  opcion: string;
}

export class PreguntaPruebaResponseDto {
  @ApiProperty({ example: 1 })
  idPregunta: number;

  @ApiProperty({ example: 1 })
  idPrueba: number;

  @ApiProperty({ example: '¿Cuál es el protocolo correcto?' })
  texto: string;

  @ApiProperty({
    example: 'opcion_unica',
    description: 'Descripción del tipo de pregunta (catálogo preguntas_tipo)',
  })
  tipo: string;

  @ApiProperty({ example: 1 })
  orden: number;

  @ApiProperty({ type: [PreguntaOpcionPublicDto] })
  opciones: PreguntaOpcionPublicDto[];
}
