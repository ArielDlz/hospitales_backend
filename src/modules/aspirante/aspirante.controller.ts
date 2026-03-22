import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AspiranteService } from './aspirante.service';
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

  @Post()
  @ApiOperation({ summary: 'Crear aspirante (admin/evaluador). Envía email con link de activación.' })
  @ApiResponse({ status: 201, description: 'Aspirante creado. Email enviado con link de primer acceso.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o hospital no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe aspirante con mismo email y registro en el hospital' })
  async create(
    @Body() dto: CreateAspiranteDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.aspiranteService.create(dto, user);
  }
}
