import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Aspirante } from './aspirante.entity';
import { HospitalService } from '../hospital/hospital.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';

@Injectable()
export class AspiranteService {
  constructor(
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    private readonly hospitalService: HospitalService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    dto: CreateAspiranteDto,
    user?: JwtPayloadAdmin,
  ): Promise<Omit<Aspirante, 'passwordHash' | 'primerAccesoToken' | 'primerAccesoExpira'>> {
    if (!dto.tenantId && !dto.slug) {
      throw new BadRequestException('Se debe proporcionar tenantId o slug del hospital');
    }

    const hospital = dto.slug
      ? await this.hospitalService.findBySlug(dto.slug)
      : await this.hospitalService.findByUuid(dto.tenantId!);

    if (!hospital) {
      throw new BadRequestException('Hospital no encontrado');
    }

    if (user?.rol === RolUsuarioAdmin.Evaluador && user.tenants?.length) {
      if (!user.tenants.includes(hospital.uuid)) {
        throw new ForbiddenException('No tienes permiso para crear aspirantes en este hospital');
      }
    }

    const existing = await this.aspiranteRepository.findOne({
      where: {
        tenantId: hospital.uuid,
        email: dto.email.toLowerCase(),
        registroHospital: dto.registroHospital.trim(),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Ya existe un aspirante con este email y registro en este hospital',
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const placeholder =
      this.configService.get<string>('PRIMER_ACCESO_PLACEHOLDER') || 'pendiente';
    const passwordHash = await bcrypt.hash(placeholder, 10);

    const aspirante = this.aspiranteRepository.create({
      tenantId: hospital.uuid,
      email: dto.email.toLowerCase(),
      registroHospital: dto.registroHospital.trim(),
      passwordHash,
      apellidos: dto.apellidos.trim(),
      nombre: dto.nombre.trim(),
      telefono: dto.telefono?.trim() ?? null,
      modalidad: dto.modalidad?.trim() ?? null,
      documento: dto.documento?.trim() ?? null,
      active: false,
      primerAccesoToken: token,
      primerAccesoExpira: expira,
    });

    const saved = await this.aspiranteRepository.save(aspirante);

    await this.mailService.sendPrimerAccesoEmail(saved, token, hospital);

    const { passwordHash: _, primerAccesoToken: __, primerAccesoExpira: ___, ...result } = saved;
    return result;
  }
}
