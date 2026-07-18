import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RolUsuarioAdmin } from '../../../common/enums/rol-usuario-admin.enum';

export class EvaluadorResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del evaluador',
  })
  id: string;

  @ApiProperty({ example: 'evaluador@hospital.com' })
  email: string;

  @ApiPropertyOptional({ example: 'María García', nullable: true })
  nombre: string | null;

  @ApiPropertyOptional({
    example: 'https://bucket.s3.amazonaws.com/firmas/evaluador.png',
    description: 'URL de la imagen de firma del evaluador',
    nullable: true,
  })
  firma: string | null;

  @ApiPropertyOptional({
    example: '12345678',
    description: 'Cédula profesional del evaluador',
    nullable: true,
  })
  cedulaProfesional: string | null;

  @ApiProperty({ example: RolUsuarioAdmin.Evaluador, enum: RolUsuarioAdmin })
  rol: RolUsuarioAdmin;

  @ApiProperty({ example: false })
  isSuperuser: boolean;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({
    example: ['550e8400-e29b-41d4-a716-446655440001'],
    description: 'Hospitales asignados al evaluador',
    type: [String],
  })
  tenantIds: string[];

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({
    example: true,
    description:
      'Solo en POST /evaluadores: indica si el correo de bienvenida se envió correctamente',
  })
  emailEnviado?: boolean;
}
