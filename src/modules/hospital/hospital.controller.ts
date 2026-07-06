import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HospitalService } from './hospital.service';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { HospitalResponseDto } from './dto/hospital-response.dto';
import { TenantBySlugResponseDto } from './dto/tenant-by-slug.dto';
import { Public } from '../auth/decorators/public.decorator';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('hospitales')
@Controller('hospitales')
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Post()
  @UseGuards(AdminOnlyGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crear hospital (solo rol administrador). id, uuid, created_at y active los gestiona la BD.',
  })
  @ApiCreatedResponse({ description: 'Hospital creado', type: HospitalResponseDto })
  @ApiResponse({ status: 403, description: 'No es administrador o token inválido' })
  @ApiResponse({ status: 409, description: 'Slug ya existente' })
  async create(
    @Body() dto: CreateHospitalDto,
    @CurrentUser() user: JwtPayloadAdmin,
  ): Promise<HospitalResponseDto> {
    return this.hospitalService.create(dto, user);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar todos los hospitales (solo activos por defecto)' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Si es "true", incluye hospitales inactivos',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de hospitales',
    type: [HospitalResponseDto],
  })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.hospitalService.findAll(includeInactive === 'true');
  }

  @Public()
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Obtener tenant por slug' })
  @ApiParam({ name: 'slug', description: 'Slug único del hospital' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Si es "true", incluye hospitales inactivos',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del tenant (hospital)',
    type: TenantBySlugResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async getTenantBySlug(
    @Param('slug') slug: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const tenant = await this.hospitalService.findTenantBySlug(
      slug,
      includeInactive === 'true',
    );
    if (!tenant) {
      throw new NotFoundException(`Tenant con slug "${slug}" no encontrado`);
    }
    return tenant;
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Obtener hospital por ID' })
  @ApiParam({ name: 'id', description: 'ID numérico del hospital' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Si es "true", incluye hospitales inactivos',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del hospital',
    type: HospitalResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Hospital no encontrado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const hospital = await this.hospitalService.findOne(
      id,
      includeInactive === 'true',
    );
    if (!hospital) {
      throw new NotFoundException(`Hospital con id "${id}" no encontrado`);
    }
    return hospital;
  }
}
