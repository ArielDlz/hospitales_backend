import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AspiranteService } from './aspirante.service';
import { AspiranteResponseDto } from './dto/aspirante-response.dto';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('aspirantes')
@Controller('aspirantes')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class AspiranteController {
  constructor(private readonly aspiranteService: AspiranteService) {}

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
}
