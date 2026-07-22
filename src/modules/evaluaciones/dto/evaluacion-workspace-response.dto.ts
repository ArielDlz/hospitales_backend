import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { PreguntaPruebaResponseDto } from '../../pruebas/dto/pregunta-prueba-response.dto';
import {
  IntentoResumenEstadisticasDto,
  PreguntaResumenWorkspaceDto,
} from '../../pruebas/dto/pregunta-resumen-workspace.dto';
import { AspiranteEvaluacionResponseDto } from './aspirante-evaluacion-response.dto';
import {
  EvaluacionIntentoResumenEstadisticasDto,
  EvaluacionPreguntaResumenDto,
} from './evaluacion-pregunta-resumen.dto';

export class EvaluacionRespuestaDisplayDto {
  @ApiProperty({ example: 101 })
  idPruebaRespuesta: number;

  @ApiProperty({ example: 3 })
  idPregunta: number;

  @ApiProperty({ example: 'texto_libre' })
  tipo: string;

  @ApiProperty({
    description:
      'Valor para mostrar: texto, URL, etiqueta de opción o arreglo de etiquetas',
    example: 'Respuesta del aspirante',
  })
  respuesta: string | string[] | null;

  @ApiPropertyOptional({
    example: true,
    nullable: true,
    description:
      'Presente solo en opcion_unica/opcion_multiple: indica si la respuesta coincide con la(s) opción(es) correcta(s)',
  })
  esCorrecta?: boolean | null;
}

@ApiExtraModels(PreguntaPruebaResponseDto, PreguntaResumenWorkspaceDto)
export class EvaluacionIntentoWorkspaceDto {
  @ApiProperty({ example: 19 })
  idPruebaAspirante: number;

  @ApiProperty({ example: 5 })
  idPrueba: number;

  @ApiProperty({ example: 'Test de personalidad' })
  nombrePrueba: string;

  @ApiProperty({ example: 'por_evaluar' })
  status: string;

  @ApiProperty({ example: '2025-05-30T10:00:00.000Z', nullable: true })
  inicioAt: Date | null;

  @ApiProperty({ example: '2025-05-30T11:00:00.000Z', nullable: true })
  finAt: Date | null;

  @ApiPropertyOptional({
    example: 'completo',
    enum: ['completo', 'resumen'],
    description:
      'resumen: preguntas con opción elegida embebida (p. ej. Prueba Raven). completo: preguntas + respuestas separadas',
  })
  formato?: 'completo' | 'resumen';

  @ApiPropertyOptional({
    type: IntentoResumenEstadisticasDto,
    description: 'Solo cuando formato=resumen',
  })
  resumenEstadisticas?: EvaluacionIntentoResumenEstadisticasDto;

  @ApiProperty({
    description:
      'Formato completo: preguntas con todas las opciones. Formato resumen: preguntas con respuesta embebida',
    oneOf: [
      { type: 'array', items: { $ref: getSchemaPath(PreguntaPruebaResponseDto) } },
      { type: 'array', items: { $ref: getSchemaPath(PreguntaResumenWorkspaceDto) } },
    ],
  })
  preguntas: PreguntaPruebaResponseDto[] | EvaluacionPreguntaResumenDto[];

  @ApiPropertyOptional({
    type: [EvaluacionRespuestaDisplayDto],
    description: 'Omitido o vacío cuando formato=resumen',
  })
  respuestas?: EvaluacionRespuestaDisplayDto[];
}

export class EvaluacionAspiranteResumenDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Juan García' })
  nombreCompleto: string;

  @ApiProperty({ example: 'REG-2024-001' })
  registroHospital: string;

  @ApiProperty({ example: 'aspirante@example.com' })
  email: string;

  @ApiProperty({
    example: 31,
    nullable: true,
    description: 'Edad calculada desde fecha_nacimiento; null si no hay fecha',
  })
  edad: number | null;

  @ApiProperty({ example: 'Cardiología', nullable: true })
  especialidad: string | null;

  @ApiProperty({ example: 6 })
  evaluationFlowOrderId: number;

  @ApiProperty({ example: 'Evaluación en curso', nullable: true })
  evaluationFlowDescripcion: string | null;
}

export class EvaluacionWorkspaceResponseDto {
  @ApiProperty({ type: EvaluacionAspiranteResumenDto })
  aspirante: EvaluacionAspiranteResumenDto;

  @ApiProperty({
    type: AspiranteEvaluacionResponseDto,
    nullable: true,
    description: 'Informe final guardado, o null si aún no se envió',
  })
  evaluacionAspirante: AspiranteEvaluacionResponseDto | null;

  @ApiProperty({
    example: true,
    description:
      'true si hay informe sin confirmar y el aspirante está en paso 6',
  })
  canConfirmarEvaluacion: boolean;

  @ApiProperty({
    example: true,
    description:
      'true si el workspace es solo lectura (administrador o sin permiso de edición)',
  })
  readOnly: boolean;

  @ApiPropertyOptional({
    example: 'evaluador@hospital.com',
    nullable: true,
    description: 'Email del evaluador asignado al abrir el workspace',
  })
  evaluadorAsignadoEmail: string | null;

  @ApiProperty({ type: [EvaluacionIntentoWorkspaceDto] })
  intentos: EvaluacionIntentoWorkspaceDto[];
}
