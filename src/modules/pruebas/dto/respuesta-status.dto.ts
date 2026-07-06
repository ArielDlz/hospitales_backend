import { ApiProperty } from '@nestjs/swagger';

export class RespuestaStatusDto {
  @ApiProperty({ example: 'respuesta guardada correctamente' })
  message: string;

  @ApiProperty({ example: 101 })
  id_prueba_respuesta: number;
}
