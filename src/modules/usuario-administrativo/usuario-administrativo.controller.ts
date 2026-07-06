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
import { UsuarioAdministrativoService } from './usuario-administrativo.service';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';
import { EvaluadorResponseDto } from './dto/evaluador-response.dto';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('usuarios-administrativos')
@Controller('usuarios-administrativos')
export class UsuarioAdministrativoController {
  constructor(
    private readonly usuarioAdministrativoService: UsuarioAdministrativoService,
  ) {}

  @Get('evaluadores')
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Listar evaluadores (solo administrador). Activos por defecto.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Si es "true", incluye evaluadores con active=false',
  })
  @ApiOkResponse({
    description: 'Lista de evaluadores con sus tenants asignados',
    type: [EvaluadorResponseDto],
  })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  async findAllEvaluadores(
    @Query('includeInactive') includeInactive: string | undefined,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<EvaluadorResponseDto[]> {
    return this.usuarioAdministrativoService.findAllEvaluadores(
      user,
      includeInactive === 'true',
    );
  }

  @Post('evaluadores')
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Crear evaluador (solo administrador). El evaluador inicia sesión con POST /auth/admin/login.',
  })
  @ApiCreatedResponse({
    description:
      'Evaluador creado con asignaciones de tenant. Incluye emailEnviado: true si el correo de bienvenida se envió.',
    type: EvaluadorResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Tenant inválido o inactivo' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async createEvaluador(
    @Body() dto: CreateEvaluadorDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<EvaluadorResponseDto> {
    return this.usuarioAdministrativoService.createEvaluador(dto, user);
  }
}
