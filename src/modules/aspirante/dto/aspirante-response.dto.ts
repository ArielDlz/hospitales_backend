import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Campos que expone la API (sin password ni token de primer acceso). Incluye fecha de caducidad del enlace. */
export class AspiranteResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'ID del aspirante',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID del hospital (tenant)',
  })
  tenantId: string;

  @ApiPropertyOptional({
    example: 'Hospital General',
    description:
      'Nombre del hospital al que pertenece el aspirante. Se incluye en GET /aspirantes.',
    nullable: true,
  })
  hospitalNombre?: string | null;

  @ApiProperty({
    example: 1,
    description: 'ID del paso actual en el flujo de evaluación (FK a evaluation_flow_steps)',
  })
  evaluationFlowId: number;

  @ApiProperty({
    example: 'Invitado',
    nullable: true,
    description: 'Texto del paso actual (desde catálogo), útil para mostrar en el frontend',
  })
  evaluationFlowDescripcion: string | null;

  @ApiPropertyOptional({
    example: 5,
    nullable: true,
    description:
      'order_id del paso actual en evaluation_flow_steps (GET /aspirantes). Pasos 5–6 habilitan evaluación.',
  })
  evaluationFlowOrderId?: number | null;

  @ApiPropertyOptional({
    example: 'Juan García',
    description: 'nombre + apellidos concatenados (GET /aspirantes, tabla de evaluadores)',
  })
  nombreCompleto?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'true si el aspirante está en order_id 5 o 6 y puede evaluarse o continuar evaluación (GET /aspirantes)',
  })
  canEvaluar?: boolean;

  @ApiPropertyOptional({
    example: 'evaluador@hospital.com',
    nullable: true,
    description:
      'Email del evaluador que tomó la evaluación al abrir el workspace (null si aún no asignado)',
  })
  evaluadorAsignadoEmail?: string | null;

  @ApiProperty({ example: 'aspirante@example.com' })
  email: string;

  @ApiProperty({
    example: 'REG-2024-001',
    description: 'Registro asignado por el hospital',
  })
  registroHospital: string;

  @ApiProperty({ example: 'García' })
  apellidos: string;

  @ApiProperty({ example: 'Juan' })
  nombre: string;

  @ApiProperty({ example: '+34612345678', nullable: true })
  telefono: string | null;

  @ApiProperty({ example: 'presencial', nullable: true })
  modalidad: string | null;

  @ApiProperty({ example: 'Cardiología', nullable: true })
  especialidad: string | null;

  @ApiProperty({ example: 'Mexicana', nullable: true })
  nacionalidad: string | null;

  @ApiProperty({ example: 'AUCR020402XXX', nullable: true })
  rfc: string | null;

  @ApiProperty({ example: '12345678A', nullable: true })
  documento: string | null;

  @ApiProperty({ example: 'Hombre', nullable: true })
  genero: string | null;

  @ApiProperty({ example: '1995-03-15', nullable: true })
  fechaNacimiento: string | null;

  @ApiProperty({
    description: 'Borrado lógico / estado activo',
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description: 'Caducidad del enlace de primer acceso (null si ya no aplica)',
    example: '2025-01-22T10:30:00.000Z',
    nullable: true,
  })
  primerAccesoExpira: Date | null;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({
    example: true,
    description:
      'Indica si el correo de activación se envió correctamente al crear el aspirante (solo en POST create)',
  })
  emailEnviado?: boolean;

  @ApiPropertyOptional({
    example:
      'https://bucket.s3.amazonaws.com/informes-firmados/REG-001 - Juan García - Hospital General.pdf',
    nullable: true,
    description: 'URL del informe PDF firmado en S3, o null si aún no se firmó',
  })
  veredictoInforme?: string | null;
}
