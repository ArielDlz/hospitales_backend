import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateHospitalDto {
  @ApiProperty({ example: 'Hospital General', description: 'Nombre del hospital' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  nombre: string;

  @ApiPropertyOptional({
    example: 'https://example.com/logo.png',
    description: 'URL del logo (opcional)',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  logoUrl?: string | null;

  @ApiProperty({
    example: 'hospital-general',
    description: 'Slug único (minúsculas, números y guiones)',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug solo puede contener letras minúsculas, números y guiones',
  })
  slug: string;
}
