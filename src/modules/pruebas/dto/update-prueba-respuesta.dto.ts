import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsOptional, IsString } from 'class-validator';

export class UpdatePruebaRespuestaDto {
  @ApiPropertyOptional({
    example: 'opcion_unica',
    description:
      'Opcional. Si no se envía, backend infiere el tipo a partir de la pregunta. Soporta archivo/cargar_archivo.',
  })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiProperty({
    description:
      'Nueva respuesta: string para texto/archivo, number para opcion_unica, number[] para opcion_multiple',
    example: 'Respuesta actualizada',
  })
  @IsDefined()
  respuesta: unknown;
}
