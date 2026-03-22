import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ActivarCuentaDto {
  @ApiProperty({
    example: 'abc123...',
    description: 'Token de primer acceso recibido por email',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'hospital-general',
    description: 'Slug del hospital (tenant). Debe coincidir con el aspirante del token.',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'Juan', description: 'Nombre' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'García López', description: 'Apellidos' })
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

  @ApiProperty({ example: '+34612345678', description: 'Teléfono' })
  @IsString()
  @IsNotEmpty()
  telefono: string;

  @ApiProperty({
    example: '********',
    description: 'Nueva contraseña',
    minLength: 8,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
