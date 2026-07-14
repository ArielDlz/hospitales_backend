import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SolicitudesAccesoService } from './solicitudes-acceso.service';
import { CreateSolicitudAccesoDto } from './dto/create-solicitud-acceso.dto';
import { CreateSolicitudAccesoResponseDto } from './dto/create-solicitud-acceso-response.dto';

@ApiTags('solicitudes-acceso')
@Controller('solicitudes-acceso')
export class SolicitudesAccesoController {
  constructor(private readonly solicitudesAccesoService: SolicitudesAccesoService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Solicitar acceso (público). Para personas que no están aún en aspirantes.',
  })
  @ApiOkResponse({ type: CreateSolicitudAccesoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async create(@Body() dto: CreateSolicitudAccesoDto) {
    return this.solicitudesAccesoService.create(dto);
  }
}
