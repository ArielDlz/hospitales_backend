import { ApiProperty } from '@nestjs/swagger';

export class HospitalResponseDto {
  @ApiProperty({ example: 1, description: 'ID del hospital' })
  id: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID del hospital',
  })
  uuid: string;

  @ApiProperty({ example: 'Hospital General', description: 'Nombre del hospital' })
  nombre: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    description: 'URL del logo del hospital',
    nullable: true,
  })
  logoUrl: string | null;

  @ApiProperty({
    example: 'hospital-general',
    description: 'Slug único del hospital',
  })
  slug: string;

  @ApiProperty({
    example: '2025-01-15T10:30:00.000Z',
    description: 'Fecha de creación',
  })
  createdAt: Date;

  @ApiProperty({ example: true, description: 'Indica si el hospital está activo' })
  active: boolean;
}
