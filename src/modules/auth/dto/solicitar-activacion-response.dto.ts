import { ApiProperty } from '@nestjs/swagger';

export enum SolicitarActivacionEstado {
  YaActivo = 'ya_activo',
  ActivacionEnviada = 'activacion_enviada',
  NoEncontrado = 'no_encontrado',
}

export class SolicitarActivacionResponseDto {
  @ApiProperty({
    enum: SolicitarActivacionEstado,
    example: SolicitarActivacionEstado.ActivacionEnviada,
  })
  estado: SolicitarActivacionEstado;

  @ApiProperty({ example: 'Si los datos coinciden, enviamos un correo para activar tu cuenta.' })
  mensaje: string;
}
