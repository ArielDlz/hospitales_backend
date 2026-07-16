import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { GeneroAspirante } from '../../../common/enums/genero-aspirante.enum';
import { IsFechaNacimientoValida } from '../../../common/validators/is-fecha-nacimiento-valida.validator';

export class CreateAspiranteDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID del hospital (tenant). Requerido si no se envía slug.',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({
    example: 'hospital-general',
    description: 'Slug del hospital (tenant). Requerido si no se envía tenantId.',
  })
  @IsOptional()
  @IsString()
  slug?: string;

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

  @ApiProperty({ example: 'García', description: 'Apellidos' })
  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @ApiProperty({ example: 'Juan', description: 'Nombre' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ example: '+34612345678', description: 'Teléfono' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional({ example: 'presencial', description: 'Modalidad' })
  @IsOptional()
  @IsString()
  modalidad?: string;

  @ApiPropertyOptional({
    example: 'Cardiología',
    description: 'Especialidad (opcional)',
  })
  @IsOptional()
  @IsString()
  especialidad?: string;

  @ApiPropertyOptional({
    example: 'Mexicana',
    description: 'Nacionalidad (opcional)',
  })
  @IsOptional()
  @IsString()
  nacionalidad?: string;

  @ApiPropertyOptional({
    example: 'AUCR020402XXX',
    description: 'RFC (opcional)',
  })
  @IsOptional()
  @IsString()
  rfc?: string;

  @ApiPropertyOptional({ example: '12345678A', description: 'Documento de identidad' })
  @IsOptional()
  @IsString()
  documento?: string;

  @ApiPropertyOptional({
    example: GeneroAspirante.Hombre,
    enum: GeneroAspirante,
    description: 'Género (opcional en creación/import)',
  })
  @IsOptional()
  @IsEnum(GeneroAspirante)
  genero?: GeneroAspirante;

  @ApiPropertyOptional({
    example: '1995-03-15',
    description: 'Fecha de nacimiento YYYY-MM-DD (opcional en creación/import)',
  })
  @IsOptional()
  @IsDateString()
  @IsFechaNacimientoValida()
  fechaNacimiento?: string;
}
