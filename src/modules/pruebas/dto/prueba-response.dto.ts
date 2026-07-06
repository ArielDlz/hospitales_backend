import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PruebaResponseDto {
  @ApiProperty({ example: 1 })
  idPrueba: number;

  @ApiProperty({ example: 'Prueba de conocimientos generales' })
  nombre: string;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Markdown',
    example: 'Instrucciones en **negrita**.',
  })
  instrucciones: string | null;
}
