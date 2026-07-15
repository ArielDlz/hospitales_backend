import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSolicitudAccesoDto {
  @ApiProperty({ example: 'hospital-general', description: 'Slug del hospital (tenant)' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'aspirante@example.com', description: 'Email del solicitante' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Juan', description: 'Nombre' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'García', description: 'Apellidos' })
  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @ApiProperty({
    example: 'REG-2024-001',
    description: 'Registro asignado por el hospital',
  })
  @IsString()
  @IsNotEmpty()
  registroHospital: string;

  @ApiProperty({ example: '+34612345678', description: 'Teléfono de contacto' })
  @IsString()
  @IsNotEmpty()
  telefono: string;

  @ApiPropertyOptional({
    example: 'Necesito acceso para completar mis pruebas',
    description: 'Comentario opcional del solicitante',
  })
  @IsOptional()
  @IsString()
  comentario?: string;
}
