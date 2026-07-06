import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PruebasService } from './pruebas.service';
import { CreatePruebaDto } from './dto/create-prueba.dto';
import { UpdatePruebaDto } from './dto/update-prueba.dto';
import { PruebaResponseDto } from './dto/prueba-response.dto';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('pruebas')
@Controller('pruebas')
@UseGuards(AdminOnlyGuard)
@ApiBearerAuth('JWT-auth')
export class PruebasController {
  constructor(private readonly pruebasService: PruebasService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar pruebas del catálogo (activas por defecto). Admin y evaluador.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Si es "true", incluye pruebas con active=false',
  })
  @ApiOkResponse({ description: 'Lista de pruebas', type: [PruebaResponseDto] })
  async findAll(@Query('includeInactive') includeInactive?: string) {
    return this.pruebasService.findAll(includeInactive === 'true');
  }

  @Get('id/:idPrueba')
  @ApiOperation({ summary: 'Obtener una prueba por id' })
  @ApiParam({ name: 'idPrueba', description: 'ID numérico de la prueba (id_prueba)' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Si es "true", permite obtener pruebas desactivadas',
  })
  @ApiOkResponse({ type: PruebaResponseDto })
  @ApiResponse({ status: 404, description: 'Prueba no encontrada' })
  async findOne(
    @Param('idPrueba', ParseIntPipe) idPrueba: number,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const prueba = await this.pruebasService.findOne(
      idPrueba,
      includeInactive === 'true',
    );
    if (!prueba) {
      throw new NotFoundException(`Prueba con id ${idPrueba} no encontrada`);
    }
    return prueba;
  }

  @Post()
  @ApiOperation({ summary: 'Crear prueba (solo administrador)' })
  @ApiCreatedResponse({ description: 'Prueba creada', type: PruebaResponseDto })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  async create(
    @Body() dto: CreatePruebaDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.pruebasService.create(dto, user);
  }

  @Patch('id/:idPrueba')
  @ApiOperation({
    summary: 'Actualizar prueba (solo administrador). Campos parciales.',
  })
  @ApiParam({ name: 'idPrueba', description: 'ID numérico de la prueba' })
  @ApiOkResponse({ type: PruebaResponseDto })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 404, description: 'Prueba no encontrada' })
  async update(
    @Param('idPrueba', ParseIntPipe) idPrueba: number,
    @Body() dto: UpdatePruebaDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.pruebasService.update(idPrueba, dto, user);
  }

  @Delete('id/:idPrueba')
  @ApiOperation({
    summary:
      'Eliminar prueba en sentido lógico (active=false). Solo administrador.',
  })
  @ApiParam({ name: 'idPrueba', description: 'ID numérico de la prueba' })
  @ApiOkResponse({
    description: 'Prueba desactivada',
    type: PruebaResponseDto,
  })
  @ApiResponse({ status: 403, description: 'No es administrador' })
  @ApiResponse({ status: 404, description: 'Prueba no encontrada' })
  async remove(
    @Param('idPrueba', ParseIntPipe) idPrueba: number,
    @CurrentUser() user: JwtPayloadAdmin,
  ) {
    return this.pruebasService.softDelete(idPrueba, user);
  }
}
