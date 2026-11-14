import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReplaceRondaEvaluadoresDto } from './dto/replace-ronda-evaluadores.dto';
import { RondaFechaCierreResponseDto } from './dto/ronda-fecha-cierre-response.dto';
import { UpdateRondaEvaluacionDto } from './dto/update-ronda-evaluacion.dto';
import { UpdateRondaFechaCierreDto } from './dto/update-ronda-fecha-cierre.dto';
import { RondaService } from './ronda.service';

@ApiTags('rondas')
@Controller('rondas')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@ApiBearerAuth()
export class RondaController {
  constructor(private readonly rondaService: RondaService) {}

  @Patch(':id')
  @ApiOperation({
    summary:
      'Programar o quitar el cierre de una ronda (solo administrador). No modifica aspirantes.active.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la ronda' })
  @ApiOkResponse({ type: RondaFechaCierreResponseDto })
  @ApiResponse({ status: 400, description: 'fechaCierre inválida' })
  @ApiResponse({ status: 403, description: 'Se requiere administrador' })
  @ApiResponse({ status: 404, description: 'Ronda no encontrada' })
  updateFechaCierre(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRondaFechaCierreDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.rondaService.updateFechaCierre(id, dto, user);
  }

  @Patch(':id/evaluacion')
  @ApiOperation({
    summary:
      'Activar o cerrar la evaluación de una ronda (solo administrador). No modifica la lista de evaluadores.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la ronda' })
  @ApiResponse({ status: 403, description: 'Se requiere administrador' })
  @ApiResponse({ status: 404, description: 'Ronda no encontrada' })
  updatePuedeEvaluar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRondaEvaluacionDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.rondaService.updatePuedeEvaluar(id, dto, user);
  }

  @Put(':id/evaluadores')
  @ApiOperation({
    summary:
      'Reemplaza los evaluadores que pueden tomar aspirantes de la ronda. Lista vacía: cualquiera. Solo administrador.',
  })
  @ApiParam({ name: 'id', description: 'UUID de la ronda' })
  @ApiResponse({ status: 400, description: 'Algún usuario no existe o no es evaluador' })
  @ApiResponse({ status: 403, description: 'Se requiere administrador' })
  @ApiResponse({ status: 404, description: 'Ronda no encontrada' })
  replaceEvaluadores(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceRondaEvaluadoresDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.rondaService.replaceEvaluadores(id, dto, user);
  }
}
