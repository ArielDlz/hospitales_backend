import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital } from './hospital.entity';
import { CreateHospitalDto } from './dto/create-hospital.dto';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';

@Injectable()
export class HospitalService {
  constructor(
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
  ) {}

  async findAll(includeInactive = false): Promise<Hospital[]> {
    const where = includeInactive ? {} : { active: true };
    return this.hospitalRepository.find({ where });
  }

  async findOne(id: number, includeInactive = false): Promise<Hospital | null> {
    const where: { id: number; active?: boolean } = { id };
    if (!includeInactive) where.active = true;
    return this.hospitalRepository.findOne({ where });
  }

  async findByUuid(uuid: string, includeInactive = false): Promise<Hospital | null> {
    const where: { uuid: string; active?: boolean } = { uuid };
    if (!includeInactive) where.active = true;
    return this.hospitalRepository.findOne({ where });
  }

  async findBySlug(slug: string, includeInactive = false): Promise<Hospital | null> {
    const where: { slug: string; active?: boolean } = { slug };
    if (!includeInactive) where.active = true;
    return this.hospitalRepository.findOne({ where });
  }

  async create(dto: CreateHospitalDto, user: JwtPayloadAdmin): Promise<Hospital> {
    if (user.rol !== RolUsuarioAdmin.Administrador) {
      throw new ForbiddenException('Solo los administradores pueden crear hospitales');
    }

    const slug = dto.slug.trim().toLowerCase();
    const existing = await this.findBySlug(slug, true);
    if (existing) {
      throw new ConflictException('Ya existe un hospital con este slug');
    }

    const entity = this.hospitalRepository.create({
      nombre: dto.nombre.trim(),
      logoUrl: dto.logoUrl?.trim() ?? null,
      slug,
    });

    const saved = await this.hospitalRepository.save(entity);
    if (!saved.uuid) {
      const reloaded = await this.findOne(saved.id, true);
      return reloaded!;
    }
    return saved;
  }

  async findTenantBySlug(slug: string, includeInactive = false) {
    const where: { slug: string; active?: boolean } = { slug };
    if (!includeInactive) where.active = true;
    const hospital = await this.hospitalRepository.findOne({
      where,
      select: [
        'uuid',
        'nombre',
        'logoUrl',
        'active',
        'envioCorreoRegistro',
        'accesoAbreAt',
        'accesoCierraAt',
      ],
    });
    if (!hospital) return null;
    return {
      uuid: hospital.uuid,
      nombre: hospital.nombre,
      logo_url: hospital.logoUrl,
      active: hospital.active,
      envio_correo_registro: hospital.envioCorreoRegistro,
      acceso_abre_at: hospital.accesoAbreAt,
      acceso_cierra_at: hospital.accesoCierraAt,
    };
  }
}
