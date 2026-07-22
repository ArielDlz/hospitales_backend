import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateEvaluadorDto {
  @ApiProperty({
    example: 'María',
    description: 'Nombre del evaluador (se usa en el correo de bienvenida)',
  })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({
    example: 'evaluador@hospital.com',
    description: 'Email del evaluador (único)',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'SecurePass123',
    description: 'Contraseña (mínimo 8 caracteres)',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'https://bucket.s3.amazonaws.com/firmas/evaluador.png',
    description: 'URL de la imagen de firma del evaluador',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  firma?: string | null;

  @ApiPropertyOptional({
    example: '12345678',
    description: 'Cédula profesional del evaluador',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  cedulaProfesional?: string | null;

  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'UUIDs de hospitales (tenants) a los que tendrá acceso',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  tenantIds!: string[];
}
