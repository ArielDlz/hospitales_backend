import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SolicitudAcceso } from './solicitud-acceso.entity';
import { Aspirante } from '../aspirante/aspirante.entity';
import { HospitalService } from '../hospital/hospital.service';
import { assertTenantAccessWindow } from '../hospital/tenant-access-window';
import { CreateSolicitudAccesoDto } from './dto/create-solicitud-acceso.dto';
import {
  CreateSolicitudAccesoEstado,
  CreateSolicitudAccesoResponseDto,
} from './dto/create-solicitud-acceso-response.dto';

@Injectable()
export class SolicitudesAccesoService {
  private readonly logger = new Logger(SolicitudesAccesoService.name);

  constructor(
    @InjectRepository(SolicitudAcceso)
    private readonly solicitudRepository: Repository<SolicitudAcceso>,
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    private readonly hospitalService: HospitalService,
  ) {}

  async create(
    dto: CreateSolicitudAccesoDto,
  ): Promise<CreateSolicitudAccesoResponseDto> {
    const slug = dto.slug.trim().toLowerCase();
    const email = dto.email.toLowerCase().trim();
    const registroHospital = dto.registroHospital.trim();

    const hospital = await this.hospitalService.findBySlug(slug);
    if (!hospital) {
      return {
        estado: CreateSolicitudAccesoEstado.HospitalNoEncontrado,
        mensaje: 'No encontramos el hospital indicado.',
      };
    }

    assertTenantAccessWindow(hospital);

    const aspirante = await this.aspiranteRepository.findOne({
      where: {
        tenantId: hospital.uuid,
        email,
        registroHospital,
      },
      select: ['id'],
    });
    if (aspirante) {
      return {
        estado: CreateSolicitudAccesoEstado.YaAspirante,
        mensaje:
          'Ya existe un registro con este correo y número de registro. Inicia sesión o solicita activación de tu cuenta.',
      };
    }

    const pendiente = await this.solicitudRepository
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId: hospital.uuid })
      .andWhere('LOWER(s.email) = :email', { email })
      .andWhere('s.estado = :estado', { estado: 'pendiente' })
      .select(['s.id'])
      .getOne();

    if (pendiente) {
      return {
        estado: CreateSolicitudAccesoEstado.YaSolicitada,
        mensaje:
          'Ya enviaste una solicitud de acceso con este correo. Espera la revisión del hospital.',
      };
    }

    const entity = this.solicitudRepository.create({
      tenantId: hospital.uuid,
      email,
      nombre: dto.nombre.trim(),
      apellidos: dto.apellidos.trim(),
      registroHospital,
      telefono: dto.telefono.trim(),
      comentario: dto.comentario?.trim() || null,
      estado: 'pendiente',
    });

    try {
      await this.solicitudRepository.save(entity);
    } catch (err) {
      if (this.isPendingEmailUniqueViolation(err)) {
        return {
          estado: CreateSolicitudAccesoEstado.YaSolicitada,
          mensaje:
            'Ya enviaste una solicitud de acceso con este correo. Espera la revisión del hospital.',
        };
      }
      this.logger.error(
        `Fallo al guardar solicitud de acceso: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    return {
      estado: CreateSolicitudAccesoEstado.Creada,
      mensaje: 'Solicitud enviada. El hospital la revisará.',
    };
  }

  private isPendingEmailUniqueViolation(err: unknown): boolean {
    if (!(err instanceof QueryFailedError)) return false;
    const driver = err.driverError as { code?: string; constraint?: string } | undefined;
    return (
      driver?.code === '23505' &&
      (driver.constraint === 'uk_solicitudes_acceso_tenant_email_pendiente' ||
        String(driver.constraint ?? '').includes('solicitudes_acceso'))
    );
  }
}
