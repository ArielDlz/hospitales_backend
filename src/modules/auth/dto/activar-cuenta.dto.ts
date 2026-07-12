import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { GeneroAspirante } from '../../../common/enums/genero-aspirante.enum';
import { IsFechaNacimientoValida } from '../../../common/validators/is-fecha-nacimiento-valida.validator';

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

  @ApiProperty({
    example: 'REG-2024-001',
    description: 'Registro asignado por el hospital',
  })
  @IsString()
  @IsNotEmpty()
  registroHospital: string;

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

  @ApiProperty({
    example: GeneroAspirante.Hombre,
    enum: GeneroAspirante,
    description: 'Género del aspirante',
  })
  @IsEnum(GeneroAspirante)
  genero: GeneroAspirante;

  @ApiProperty({
    example: '1995-03-15',
    description: 'Fecha de nacimiento (YYYY-MM-DD). Edad entre 15 y 99 años.',
  })
  @IsDateString()
  @IsFechaNacimientoValida()
  fechaNacimiento: string;
}
