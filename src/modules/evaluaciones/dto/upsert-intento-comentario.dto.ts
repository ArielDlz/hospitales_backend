import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpsertIntentoComentarioDto {
  @ApiProperty({
    example: 'El aspirante respondió con claridad en las preguntas abiertas.',
    description: 'Comentario del evaluador sobre este intento de prueba',
  })
  @IsString()
  @IsNotEmpty()
  comentario: string;
}

export class IntentoComentarioResponseDto {
  @ApiProperty({ example: 19 })
  idPruebaAspirante: number;

  @ApiProperty({ example: 'Comentario guardado.' })
  comentario: string;

  @ApiProperty({ example: '2025-05-31T12:00:00.000Z' })
  updatedAt: Date;
}
