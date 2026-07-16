import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AspiranteService } from './aspirante.service';
import { AspiranteImportService } from './import/aspirante-import.service';
import { AspiranteResponseDto } from './dto/aspirante-response.dto';
import { AspiranteImportReportDto } from './dto/aspirante-import-report.dto';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { SuperuserGuard } from '../auth/guards/superuser.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';

const XLSX_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

@ApiTags('aspirantes')
@Controller('aspirantes')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class AspiranteController {
  constructor(
    private readonly aspiranteService: AspiranteService,
    private readonly aspiranteImportService: AspiranteImportService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar aspirantes (solo activos por defecto). Requiere tenantId o slug. Si slug=admin, lista global: administradores ven todos los aspirantes; evaluadores solo los de sus hospitales asignados.',
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    description: 'UUID del hospital (tenant). Obligatorio si no se envía slug.',
  })
  @ApiQuery({
    name: 'slug',
    required: false,
    description:
      'Slug del hospital. Obligatorio si no se envía tenantId. Valor especial "admin": todos los aspirantes (admin global) o filtrado por tenants del evaluador.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Si es "true", incluye aspirantes con active=false (borrado lógico)',
  })
  @ApiOkResponse({
    description:
      'Array de aspirantes (sin password ni token de primer acceso). Incluye nombreCompleto, hospitalNombre, evaluationFlowDescripcion, evaluationFlowOrderId y canEvaluar para tablas de evaluador.',
    type: AspiranteResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: 'Falta tenantId/slug o hospital no encontrado' })
  @ApiResponse({ status: 403, description: 'Evaluador sin permiso para ese hospital' })
  async findAll(
    @Query('tenantId') tenantId: string | undefined,
    @Query('slug') slug: string | undefined,
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.aspiranteService.findAll(
      tenantId,
      slug,
      includeInactive === 'true',
      user,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Crear aspirante (admin/evaluador). Envía email con link de activación.' })
  @ApiCreatedResponse({
    description:
      'Aspirante creado. Incluye emailEnviado: true si el correo de activación se envió; false si falló (el aspirante queda registrado).',
    type: AspiranteResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o hospital no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe aspirante con mismo email y registro en el hospital' })
  async create(
    @Body() dto: CreateAspiranteDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.aspiranteService.create(dto, user);
  }

  @Post('import/validate')
  @UseGuards(SuperuserGuard)
  @ApiOperation({
    summary:
      'Validar importación masiva de aspirantes desde Excel (.xlsx). Dry-run: no escribe ni envía correos. Solo superusuario.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'tenantId'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo .xlsx' },
        tenantId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID del hospital (tenant)',
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Reporte de validación. ok=true si todas las filas pasarían; ok=false con errors detallados por fila.',
    type: AspiranteImportReportDto,
  })
  @ApiResponse({ status: 400, description: 'Archivo inválido, tenantId faltante u hospital no encontrado' })
  @ApiResponse({ status: 403, description: 'Requiere superusuario' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const name = (file.originalname || '').toLowerCase();
        const okMime = XLSX_MIME.includes(file.mimetype);
        const okExt = name.endsWith('.xlsx');
        if (!okMime && !okExt) {
          return cb(
            new BadRequestException(
              'Tipo de archivo no permitido. Usa un archivo .xlsx',
            ) as unknown as Error,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async validateImport(
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname: string } | undefined,
    @Body('tenantId') tenantId: string | undefined,
  ): Promise<AspiranteImportReportDto> {
    if (!file?.buffer) {
      throw new BadRequestException('Debes enviar un archivo en el campo "file"');
    }
    return this.aspiranteImportService.validate(file.buffer, tenantId ?? '');
  }

  @Post('import')
  @UseGuards(SuperuserGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Importar aspirantes desde Excel (.xlsx). All-or-nothing: si alguna fila falla, no se crea ninguno. Solo superusuario.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'tenantId'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo .xlsx' },
        tenantId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID del hospital (tenant)',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Importación exitosa (created + emailsEnviados según flag del hospital)',
    type: AspiranteImportReportDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validación fallida (mismo reporte que validate) o archivo/tenant inválido',
    type: AspiranteImportReportDto,
  })
  @ApiResponse({ status: 403, description: 'Requiere superusuario' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const name = (file.originalname || '').toLowerCase();
        const okMime = XLSX_MIME.includes(file.mimetype);
        const okExt = name.endsWith('.xlsx');
        if (!okMime && !okExt) {
          return cb(
            new BadRequestException(
              'Tipo de archivo no permitido. Usa un archivo .xlsx',
            ) as unknown as Error,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async importAspirantes(
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname: string } | undefined,
    @Body('tenantId') tenantId: string | undefined,
  ): Promise<AspiranteImportReportDto> {
    if (!file?.buffer) {
      throw new BadRequestException('Debes enviar un archivo en el campo "file"');
    }
    return this.aspiranteImportService.import(file.buffer, tenantId ?? '');
  }

  @Delete(':id')
  @UseGuards(SuperuserGuard)
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Eliminar aspirante (borrado definitivo). Anonimiza pagos y elimina el resto. Solo superusuario.',
  })
  @ApiParam({ name: 'id', description: 'UUID del aspirante' })
  @ApiNoContentResponse({ description: 'Aspirante eliminado y pagos anonimizados' })
  @ApiResponse({ status: 403, description: 'Requiere superusuario' })
  @ApiResponse({ status: 404, description: 'Aspirante no encontrado' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<void> {
    await this.aspiranteService.remove(id, user);
  }
}
