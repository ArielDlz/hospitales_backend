import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SolicitarActivacionDto {
  @ApiProperty({ example: 'hospital-general', description: 'Slug del hospital (tenant)' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'aspirante@example.com', description: 'Email del aspirante' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'REG-2024-001',
    description: 'Registro asignado por el hospital',
  })
  @IsString()
  @IsNotEmpty()
  registroHospital: string;

  @ApiPropertyOptional({
    example: 'Ronda 2026',
    description:
      'Etiqueta de la ronda. Obligatoria si el mismo email y registro existen en más de una ronda.',
  })
  @IsOptional()
  @IsString()
  rondaEtiqueta?: string;
}
