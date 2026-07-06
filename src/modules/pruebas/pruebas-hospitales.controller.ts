import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PruebasService } from './pruebas.service';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { CreatePruebaHospitalDto } from './dto/create-prueba-hospital.dto';
import { UpdatePruebaHospitalDto } from './dto/update-prueba-hospital.dto';
import { PruebaHospitalResponseDto } from './dto/prueba-hospital-response.dto';
import { PruebaResponseDto } from './dto/prueba-response.dto';

@ApiTags('pruebas')
@Controller('pruebas/hospitales')
@ApiBearerAuth('JWT-auth')
export class PruebasHospitalesController {
  constructor(private readonly pruebasService: PruebasService) {}

  @Get('by-tenant/:slug')
  @ApiOperation({
    summary:
      'Listar pruebas disponibles para un tenant por slug (solo show=true y prueba active=true)',
  })
  @ApiParam({
    name: 'slug',
    description: 'Slug del hospital (tenant)',
  })
  @ApiOkResponse({
    description: 'Pruebas disponibles para ese tenant',
    type: [PruebaResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async findAvailableByTenant(
    @Param('slug') slug: string,
  ) {
    return this.pruebasService.findAvailablePruebasByTenantSlug(slug);
  }

  @Get()
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({
    summary:
      'Listar asignaciones pruebas_hospitales (incluye show=true y show=false)',
  })
  @ApiOkResponse({
    description: 'Lista completa de asignaciones prueba-hospital',
    type: [PruebaHospitalResponseDto],
  })
  async findAll() {
    return this.pruebasService.findAllPruebasHospitales();
  }

  @Post()
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({
    summary:
      'Crear asignación prueba-hospital. Se guarda siempre con show=true',
  })
  @ApiCreatedResponse({
    description: 'Asignación creada',
    type: PruebaHospitalResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Prueba o tenant no válidos' })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 409, description: 'La asignación ya existe' })
  async create(
    @Body() dto: CreatePruebaHospitalDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.pruebasService.createPruebaHospital(dto, user);
  }

  @Patch(':idPruebaHospital')
  @UseGuards(AdminOnlyGuard)
  @ApiOperation({
    summary:
      'Actualizar solo el valor show de una asignación prueba-hospital',
  })
  @ApiParam({
    name: 'idPruebaHospital',
    description: 'ID de la asignación (id_prueba_hospital)',
  })
  @ApiOkResponse({
    description: 'Asignación actualizada',
    type: PruebaHospitalResponseDto,
  })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 404, description: 'Asignación no encontrada' })
  async update(
    @Param('idPruebaHospital', ParseIntPipe) idPruebaHospital: number,
    @Body() dto: UpdatePruebaHospitalDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.pruebasService.updatePruebaHospital(idPruebaHospital, dto, user);
  }
}
