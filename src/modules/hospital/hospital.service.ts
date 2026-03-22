import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hospital } from './hospital.entity';

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

  async findTenantBySlug(slug: string, includeInactive = false) {
    const where: { slug: string; active?: boolean } = { slug };
    if (!includeInactive) where.active = true;
    const hospital = await this.hospitalRepository.findOne({
      where,
      select: ['uuid', 'nombre', 'logoUrl', 'active'],
    });
    if (!hospital) return null;
    return {
      uuid: hospital.uuid,
      nombre: hospital.nombre,
      logo_url: hospital.logoUrl,
      active: hospital.active,
    };
  }
}
