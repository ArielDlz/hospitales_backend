import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EvaluacionesService } from './evaluaciones.service';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { VeredictoResponseDto } from './dto/veredicto-response.dto';
import { EvaluacionWorkspaceResponseDto } from './dto/evaluacion-workspace-response.dto';
import { SubmitInformeDto } from './dto/submit-informe.dto';
import {
  AspiranteEvaluacionResponseDto,
  ConfirmarEvaluacionResponseDto,
} from './dto/aspirante-evaluacion-response.dto';
import { FirmarInformeResponseDto } from './dto/firmar-informe-response.dto';
import { AsignarEvaluacionResponseDto } from './dto/asignar-evaluacion-response.dto';
import { buildContentDispositionAttachment } from './informe-firmado-filename.util';

@ApiTags('evaluaciones')
@Controller('evaluaciones')
@UseGuards(AdminOnlyGuard)
@ApiBearerAuth('JWT-auth')
export class EvaluacionesController {
  constructor(private readonly evaluacionesService: EvaluacionesService) {}

  @Get('veredictos')
  @ApiOperation({
    summary: 'Listar veredictos activos para el informe final',
  })
  @ApiOkResponse({ type: [VeredictoResponseDto] })
  async findVeredictos() {
    return this.evaluacionesService.findVeredictos();
  }

  @Post('aspirantes/:aspiranteId/asignar')
  @ApiOperation({
    summary:
      'Reservar evaluación: asigna evaluador y avanza paso 5→6 sin cargar el workspace',
  })
  @ApiCreatedResponse({ type: AsignarEvaluacionResponseDto })
  @ApiResponse({ status: 403, description: 'Evaluador sin acceso al hospital' })
  @ApiResponse({
    status: 400,
    description: 'Aspirante no está en paso 5 o 6',
  })
  async asignarEvaluacion(
    @Param('aspiranteId', ParseUUIDPipe) aspiranteId: string,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<AsignarEvaluacionResponseDto> {
    return this.evaluacionesService.asignarEvaluacion(aspiranteId, user);
  }

  @Get('aspirantes/:aspiranteId')
  @ApiOperation({
    summary:
      'Workspace de evaluación: aspirante, intentos con preguntas/respuestas e informe. Asigna evaluador y avanza paso 5→6.',
  })
  @ApiOkResponse({ type: EvaluacionWorkspaceResponseDto })
  @ApiResponse({ status: 403, description: 'Evaluador sin acceso al hospital' })
  @ApiResponse({
    status: 400,
    description: 'Aspirante no está en paso 5 o 6',
  })
  async getWorkspace(
    @Param('aspiranteId', ParseUUIDPipe) aspiranteId: string,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.evaluacionesService.getWorkspace(aspiranteId, user);
  }

  @Put('intentos/:idPruebaAspirante')
  @ApiOperation({
    summary: '[Deprecado] Comentarios por prueba ya no están soportados',
    deprecated: true,
  })
  @ApiResponse({
    status: 410,
    description:
      'Los comentarios por prueba ya no están soportados. Use el informe final del aspirante.',
  })
  async upsertIntentoComentario() {
    return this.evaluacionesService.upsertIntentoComentario();
  }

  @Get('aspirantes/:aspiranteId/informe/pdf')
  @ApiOperation({
    summary:
      'Descargar informe final en PDF (requiere informe enviado en aspirante_evaluaciones)',
  })
  @ApiResponse({ status: 404, description: 'Aspirante o informe no encontrado' })
  async downloadInformePdf(
    @Param('aspiranteId', ParseUUIDPipe) aspiranteId: string,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.evaluacionesService.generateInformePdf(
      aspiranteId,
      user,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('aspirantes/:aspiranteId/informe/firmado')
  @ApiOperation({
    summary:
      'Descargar informe firmado desde S3 (requiere aspirante.veredicto_informe)',
  })
  @ApiResponse({ status: 404, description: 'Aspirante o informe firmado no encontrado' })
  async downloadInformeFirmado(
    @Param('aspiranteId', ParseUUIDPipe) aspiranteId: string,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<StreamableFile> {
    const { buffer, filename } =
      await this.evaluacionesService.downloadInformeFirmado(aspiranteId, user);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: buildContentDispositionAttachment(filename),
    });
  }

  @Post('aspirantes/:aspiranteId/informe/firmar')
  @ApiOperation({
    summary:
      'Firmar informe: genera PDF con firma del usuario logueado, sube a S3 y guarda URL en aspirante.veredicto_informe',
  })
  @ApiCreatedResponse({ type: FirmarInformeResponseDto })
  @ApiResponse({ status: 403, description: 'Usuario sin firma configurada' })
  @ApiResponse({ status: 404, description: 'Aspirante, informe u hospital no encontrado' })
  async firmarInforme(
    @Param('aspiranteId', ParseUUIDPipe) aspiranteId: string,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<FirmarInformeResponseDto> {
    return this.evaluacionesService.firmarInforme(aspiranteId, user);
  }

  @Post('aspirantes/:aspiranteId/informe')
  @ApiOperation({
    summary:
      'Crear o actualizar informe final con comentario y veredicto (solo evaluador asignado, paso 6)',
  })
  @ApiCreatedResponse({ type: AspiranteEvaluacionResponseDto })
  @ApiConflictResponse({ description: 'Evaluación ya confirmada' })
  async submitInforme(
    @Param('aspiranteId', ParseUUIDPipe) aspiranteId: string,
    @Body() dto: SubmitInformeDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.evaluacionesService.submitInforme(aspiranteId, dto, user);
  }

  @Post('aspirantes/:aspiranteId/confirmar')
  @ApiOperation({
    summary:
      'Confirmar evaluación: avanza al paso 7 y marca pruebas como evaluada',
  })
  @ApiCreatedResponse({ type: ConfirmarEvaluacionResponseDto })
  @ApiConflictResponse({ description: 'Evaluación ya confirmada' })
  async confirmarEvaluacion(
    @Param('aspiranteId', ParseUUIDPipe) aspiranteId: string,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.evaluacionesService.confirmarEvaluacion(aspiranteId, user);
  }
}
