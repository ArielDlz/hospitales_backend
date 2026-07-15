import { ApiProperty } from '@nestjs/swagger';

export class TenantBySlugResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID del tenant/hospital',
  })
  uuid: string;

  @ApiProperty({
    example: 'Hospital General',
    description: 'Nombre del hospital',
  })
  nombre: string;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    description: 'URL del logo del hospital',
    nullable: true,
  })
  logo_url: string | null;

  @ApiProperty({ example: true, description: 'Indica si el tenant está activo' })
  active: boolean;

  @ApiProperty({
    example: true,
    description:
      'Si es true, al crear aspirante se envía correo de invitación. Si es false, el aspirante solicita activación desde el frontend de registro.',
  })
  envio_correo_registro: boolean;

  @ApiProperty({
    example: '2026-07-16T06:00:00.000Z',
    description:
      'Inicio de la ventana de acceso público aspirante (UTC). Null = sin restricción de apertura.',
    nullable: true,
  })
  acceso_abre_at: Date | null;

  @ApiProperty({
    example: '2026-08-31T05:59:59.000Z',
    description:
      'Fin de la ventana de acceso público aspirante (UTC). Null = sin restricción de cierre.',
    nullable: true,
  })
  acceso_cierra_at: Date | null;
}
