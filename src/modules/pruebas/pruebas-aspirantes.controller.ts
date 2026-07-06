import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiConsumes,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { PruebasService } from './pruebas.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { AspiranteOnlyGuard } from '../auth/guards/aspirante-only.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayloadAspirante } from '../../common/interfaces/jwt-payload.interface';
import { CreatePruebaAspiranteDto } from './dto/create-prueba-aspirante.dto';
import { PruebaAspiranteResponseDto } from './dto/prueba-aspirante-response.dto';
import { PreguntaPruebaResponseDto } from './dto/pregunta-prueba-response.dto';
import { PruebaAspiranteEstadoResponseDto } from './dto/prueba-aspirante-estado-response.dto';
import { CreatePruebaRespuestaDto } from './dto/create-prueba-respuesta.dto';
import { UpdatePruebaRespuestaDto } from './dto/update-prueba-respuesta.dto';
import { RespuestaStatusDto } from './dto/respuesta-status.dto';
import { UpdatePruebaAspiranteActionDto } from './dto/update-prueba-aspirante-action.dto';
import { PruebaRespuestasIntentoResponseDto } from './dto/prueba-respuesta-guardada.dto';

const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function buildSafeFilename(originalname: string): string {
  const extension = extname(originalname).toLowerCase();
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}${extension || '.bin'}`;
}

@ApiTags('pruebas')
@Controller('pruebas/aspirantes')
@UseGuards(AspiranteOnlyGuard)
@ApiBearerAuth('JWT-auth')
export class PruebasAspirantesController {
  constructor(
    private readonly pruebasService: PruebasService,
    private readonly s3Storage: S3StorageService,
  ) {}

  @Post('uploads/imagen')
  @ApiOperation({
    summary:
      'Subir imagen a S3 en uploads/{id_aspirante}/{filename}',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de imagen (jpeg/png/webp/gif)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Imagen cargada correctamente',
    schema: {
      properties: {
        message: { type: 'string', example: 'imagen cargada correctamente' },
        filename: { type: 'string', example: '1713675600000-ab12cd34.png' },
        url: {
          type: 'string',
          example:
            'https://hospitales-assets.s3.us-east-2.amazonaws.com/uploads/a1b2c3d4-e5f6-7890-abcd-ef1234567890/1713675600000-ab12cd34.png',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo faltante o tipo de imagen no permitido',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Tipo de archivo no permitido. Usa jpeg, png, webp o gif.',
            ) as unknown as Error,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImagen(
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname: string } | undefined,
    @CurrentUser() user: JwtPayloadAspirante,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Debes enviar un archivo en el campo "file"',
      );
    }

    const filename = buildSafeFilename(file.originalname);
    const key = `uploads/${user.sub}/${filename}`;
    const uploaded = await this.s3Storage.uploadBuffer({
      buffer: file.buffer,
      contentType: file.mimetype,
      key,
    });

    return {
      message: 'imagen cargada correctamente',
      filename,
      url: uploaded.url,
    };
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar pruebas del aspirante autenticado con estado actual',
  })
  @ApiResponse({
    status: 200,
    description:
      'Listado con pruebaActual (idPruebaAspirante + nombre) y texto del status',
    type: [PruebaAspiranteEstadoResponseDto],
  })
  async getEstadoPruebas(@CurrentUser() user: JwtPayloadAspirante) {
    return this.pruebasService.getEstadoPruebasIniciadasAspirante(user);
  }

  @Patch(':idPruebaAspirante')
  @ApiOperation({
    summary:
      'Actualizar prueba_aspirante por acción (soportada: "finalizada por el aspirante")',
  })
  @ApiResponse({
    status: 200,
    description:
      'Si la acción es válida y el estado está en iniciada, cambia a por_evaluar',
    schema: {
      properties: {
        message: { type: 'string', example: 'prueba actualizada correctamente' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Acción inválida o estado no permite transición',
  })
  @ApiResponse({
    status: 404,
    description: 'Registro pruebas_aspirantes no encontrado para el aspirante',
  })
  async updatePruebaAspiranteByAction(
    @Param('idPruebaAspirante', ParseIntPipe) idPruebaAspirante: number,
    @Body() dto: UpdatePruebaAspiranteActionDto,
    @CurrentUser() user: JwtPayloadAspirante,
  ) {
    return this.pruebasService.updatePruebaAspiranteByAction(
      idPruebaAspirante,
      dto,
      user,
    );
  }

  @Post('respuestas')
  @ApiOperation({
    summary: 'Guardar una respuesta en pruebas_respuestas',
  })
  @ApiResponse({
    status: 201,
    description: 'Respuesta creada correctamente',
    type: RespuestaStatusDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación de datos o permisos del intento',
  })
  @ApiConflictResponse({
    description: 'Ya existe respuesta para esa pregunta en ese intento',
  })
  async createRespuesta(
    @Body() dto: CreatePruebaRespuestaDto,
    @CurrentUser() user: JwtPayloadAspirante,
  ) {
    return this.pruebasService.createPruebaRespuesta(dto, user);
  }

  @Patch('respuestas/:idPruebaRespuesta')
  @ApiOperation({
    summary: 'Actualizar una respuesta existente de pruebas_respuestas',
  })
  @ApiResponse({
    status: 200,
    description: 'Respuesta actualizada correctamente',
    type: RespuestaStatusDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación de datos o permisos',
  })
  @ApiResponse({
    status: 404,
    description: 'Respuesta no encontrada',
  })
  async updateRespuesta(
    @Param('idPruebaRespuesta', ParseIntPipe) idPruebaRespuesta: number,
    @Body() dto: UpdatePruebaRespuestaDto,
    @CurrentUser() user: JwtPayloadAspirante,
  ) {
    return this.pruebasService.updatePruebaRespuesta(
      idPruebaRespuesta,
      dto,
      user,
    );
  }

  @Get(':idPruebaAspirante/respuestas')
  @ApiOperation({
    summary:
      'Obtener respuestas ya guardadas de un intento (pruebas_aspirantes)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Respuestas del intento en el mismo formato que POST (tipo + respuesta)',
    type: PruebaRespuestasIntentoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'El intento no existe o no pertenece al aspirante autenticado',
  })
  async getRespuestasByIntento(
    @Param('idPruebaAspirante', ParseIntPipe) idPruebaAspirante: number,
    @CurrentUser() user: JwtPayloadAspirante,
  ) {
    return this.pruebasService.getPruebaRespuestasByIntento(
      idPruebaAspirante,
      user,
    );
  }

  @Get(':idPrueba/preguntas')
  @ApiOperation({
    summary:
      'Obtener preguntas activas de una prueba para el aspirante autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Preguntas activas con opciones activas (sin exponer correcta)',
    type: [PreguntaPruebaResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'El aspirante no ha iniciado esta prueba',
  })
  async getPreguntasByPrueba(
    @Param('idPrueba', ParseIntPipe) idPrueba: number,
    @CurrentUser() user: JwtPayloadAspirante,
  ) {
    return this.pruebasService.getPreguntasActivasByPruebaForAspirante(
      idPrueba,
      user,
    );
  }

  @Post()
  @ApiOperation({
    summary:
      'Iniciar prueba para el aspirante autenticado (crea registro en pruebas_aspirantes)',
  })
  @ApiCreatedResponse({
    description: 'Registro creado con status=iniciada e inicio_at automático',
    type: PruebaAspiranteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Prueba inválida o no habilitada para el tenant del aspirante',
  })
  @ApiConflictResponse({
    description: 'El aspirante ya tiene un registro para esa prueba',
  })
  async create(
    @Body() dto: CreatePruebaAspiranteDto,
    @CurrentUser() user: JwtPayloadAspirante,
  ) {
    return this.pruebasService.createPruebaAspirante(dto, user);
  }
}
