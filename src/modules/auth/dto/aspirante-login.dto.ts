import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class AspiranteLoginDto {
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

  @ApiProperty({ example: '********', description: 'Contraseña', minLength: 1, format: 'password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({
    example: 'Ronda 2026',
    description:
      'Etiqueta de la ronda. Obligatoria si el mismo email y registro existen en más de una ronda activa.',
  })
  @IsOptional()
  @IsString()
  rondaEtiqueta?: string;
}
