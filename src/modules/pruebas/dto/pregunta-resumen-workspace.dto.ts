import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpcionElegidaWorkspaceDto {
  @ApiProperty({ example: 1 })
  idPreguntaOpcion: number;

  @ApiProperty({ example: 'https://example.com/op1.jpg' })
  opcion: string;

  @ApiProperty({ example: false })
  correcta: boolean;
}

export class PreguntaResumenWorkspaceDto {
  @ApiProperty({ example: 10 })
  idPregunta: number;

  @ApiProperty({ example: 3 })
  idPrueba: number;

  @ApiProperty({ example: 'https://example.com/pregunta.jpg' })
  texto: string;

  @ApiProperty({ example: 'mostrar_imagen_multi' })
  tipo: string;

  @ApiProperty({ example: 1 })
  orden: number;

  @ApiPropertyOptional({ type: OpcionElegidaWorkspaceDto, nullable: true })
  respuesta: OpcionElegidaWorkspaceDto | null;
}

export class IntentoResumenEstadisticasDto {
  @ApiProperty({ example: 60 })
  totalPreguntas: number;

  @ApiProperty({ example: 58 })
  respondidas: number;

  @ApiProperty({ example: 45 })
  correctas: number;

  @ApiProperty({ example: 13 })
  incorrectas: number;
}
