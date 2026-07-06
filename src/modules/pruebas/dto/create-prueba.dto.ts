import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePruebaDto {
  @ApiProperty({ example: 'Prueba de conocimientos generales' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  nombre: string;

  @ApiPropertyOptional({
    description: 'Instrucciones en Markdown (listas, negritas, etc.)',
    example: 'Lee con atención cada **pregunta**. Tienes tiempo limitado.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  instrucciones?: string | null;
}
