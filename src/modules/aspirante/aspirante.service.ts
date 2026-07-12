import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Aspirante } from './aspirante.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
import { HospitalService } from '../hospital/hospital.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { CreateAspiranteDto } from './dto/create-aspirante.dto';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PruebaAspirante } from '../pruebas/entities/prueba-aspirante.entity';
import { AspiranteEvaluacion } from '../evaluaciones/entities/aspirante-evaluacion.entity';
type AspirantePublic = Omit<
  Aspirante,
  'passwordHash' | 'primerAccesoToken' | 'evaluationFlowStep'
>;
type AspiranteWithHospitalName = AspirantePublic & {
  hospitalNombre: string | null;
  evaluationFlowDescripcion: string | null;
  evaluationFlowOrderId: number | null;
  nombreCompleto: string;
  canEvaluar: boolean;
  evaluadorAsignadoEmail: string | null;
};

@Injectable()
export class AspiranteService {
  private readonly logger = new Logger(AspiranteService.name);

  constructor(
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    @InjectRepository(EvaluationFlowStep)
    private readonly evaluationFlowStepRepository: Repository<EvaluationFlowStep>,
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
    private readonly hospitalService: HospitalService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateAspiranteDto,
    user?: JwtPayloadAdmin,
  ): Promise<
    Omit<Aspirante, 'passwordHash' | 'primerAccesoToken' | 'evaluationFlowStep'> & {
      evaluationFlowDescripcion: string | null;
      emailEnviado: boolean;
    }
  > {
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

    // Flujo: order_id 1 = invitación (token primer acceso + expiración)
    const pasoInvitacion = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: 1 },
    });
    if (!pasoInvitacion) {
      throw new InternalServerErrorException(
        'Catálogo evaluation_flow_steps no inicializado (falta paso order_id = 1)',
      );
    }

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
      evaluationFlowId: pasoInvitacion.id,
    });

    const saved = await this.aspiranteRepository.save(aspirante);

    let emailEnviado = true;
    try {
      await this.mailService.sendPrimerAccesoEmail(saved, token, hospital);
    } catch (err) {
      emailEnviado = false;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Fallo envío correo primer acceso (aspirante ${saved.id}): ${errorMessage}`,
      );
      try {
        await this.mailService.sendAdminMailFailureAlert({
          aspiranteId: saved.id,
          aspiranteEmail: saved.email,
          hospitalNombre: hospital.nombre,
          errorMessage,
        });
      } catch (alertErr) {
        const alertMessage =
          alertErr instanceof Error ? alertErr.message : String(alertErr);
        this.logger.error(
          `Fallo envío alerta admin por correo (aspirante ${saved.id}): ${alertMessage}`,
        );
      }
    }

    const withFlow = await this.aspiranteRepository.findOne({
      where: { id: saved.id },
      relations: ['evaluationFlowStep'],
    });
    const { passwordHash: _, primerAccesoToken: __, evaluationFlowStep, ...result } =
      withFlow!;
    return {
      ...result,
      evaluationFlowDescripcion: evaluationFlowStep?.descripcion ?? null,
      emailEnviado,
    };
  }

  async findAll(
    tenantId: string | undefined,
    slug: string | undefined,
    includeInactive: boolean,
    user: JwtPayloadAdmin,
  ): Promise<AspiranteWithHospitalName[]> {
    if (!tenantId && !slug) {
      throw new BadRequestException('Se debe proporcionar tenantId o slug del hospital');
    }

    if (slug?.trim().toLowerCase() === 'admin') {
      return this.findAllGlobal(includeInactive, user);
    }

    const hospital = slug
      ? await this.hospitalService.findBySlug(slug)
      : await this.hospitalService.findByUuid(tenantId!);

    if (!hospital) {
      throw new BadRequestException('Hospital no encontrado');
    }

    if (user?.rol === RolUsuarioAdmin.Evaluador && user.tenants?.length) {
      if (!user.tenants.includes(hospital.uuid)) {
        throw new ForbiddenException(
          'No tienes permiso para consultar aspirantes de este hospital',
        );
      }
    }

    const where: { tenantId: string; active?: boolean } = { tenantId: hospital.uuid };
    if (!includeInactive) {
      where.active = true;
    }

    const rows = await this.aspiranteRepository.find({
      where,
      relations: ['evaluationFlowStep'],
      order: { createdAt: 'DESC' },
    });

    const evaluadorEmailById = await this.loadEvaluadorEmailsById(rows);

    return rows.map((row) =>
      this.toPublicListItem(
        row,
        hospital.nombre,
        row.idEvaluadorAsignado
          ? (evaluadorEmailById.get(row.idEvaluadorAsignado) ?? null)
          : null,
      ),
    );
  }

  async remove(id: string, _requester: JwtPayloadAdmin): Promise<void> {
    const aspirante = await this.aspiranteRepository.findOne({ where: { id } });
    if (!aspirante) {
      throw new NotFoundException('Aspirante no encontrado');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Payment,
        { aspiranteId: id },
        { aspiranteId: null, anonymizedAt: new Date() },
      );

      await manager.delete(PruebaAspirante, { idAspirante: id });
      await manager.delete(AspiranteEvaluacion, { idAspirante: id });
      await manager.delete(Aspirante, { id });
    });

    this.logger.log(`Aspirante eliminado (id=${id}); pagos anonimizados`);
  }

  private async findAllGlobal(
    includeInactive: boolean,
    user: JwtPayloadAdmin,
  ): Promise<AspiranteWithHospitalName[]> {
    if (user.rol === RolUsuarioAdmin.Evaluador) {
      if (!user.tenants?.length) {
        return [];
      }
      const where = {
        tenantId: In(user.tenants),
        ...(includeInactive ? {} : { active: true }),
      };
      const rows = await this.aspiranteRepository.find({
        where,
        relations: ['evaluationFlowStep'],
        order: { createdAt: 'DESC' },
      });
      return this.mapWithHospitalName(rows);
    }

    const where: { active?: boolean } = {};
    if (!includeInactive) {
      where.active = true;
    }
    const rows = await this.aspiranteRepository.find({
      where,
      relations: ['evaluationFlowStep'],
      order: { createdAt: 'DESC' },
    });
    return this.mapWithHospitalName(rows);
  }

  private async mapWithHospitalName(rows: Aspirante[]): Promise<AspiranteWithHospitalName[]> {
    const tenantIds = [...new Set(rows.map((row) => row.tenantId))];
    const hospitals = await Promise.all(
      tenantIds.map((tenantId) => this.hospitalService.findByUuid(tenantId, true)),
    );
    const hospitalNamesByTenant = new Map<string, string | null>();
    for (const hospital of hospitals) {
      if (hospital) {
        hospitalNamesByTenant.set(hospital.uuid, hospital.nombre);
      }
    }

    const evaluadorEmailById = await this.loadEvaluadorEmailsById(rows);

    return rows.map((row) =>
      this.toPublicListItem(
        row,
        hospitalNamesByTenant.get(row.tenantId) ?? null,
        row.idEvaluadorAsignado
          ? (evaluadorEmailById.get(row.idEvaluadorAsignado) ?? null)
          : null,
      ),
    );
  }

  private async loadEvaluadorEmailsById(
    rows: Aspirante[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        rows
          .map((row) => row.idEvaluadorAsignado)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (ids.length === 0) {
      return new Map();
    }
    const usuarios = await this.usuarioRepository.find({
      where: { id: In(ids) },
      select: ['id', 'email'],
    });
    return new Map(usuarios.map((u) => [u.id, u.email]));
  }

  private toPublicListItem(
    row: Aspirante,
    hospitalNombre: string | null,
    evaluadorAsignadoEmail: string | null,
  ): AspiranteWithHospitalName {
    const { passwordHash: _, primerAccesoToken: __, evaluationFlowStep, ...rest } = row;
    const evaluationFlowOrderId = evaluationFlowStep?.orderId ?? null;
    return {
      ...rest,
      hospitalNombre,
      evaluationFlowDescripcion: evaluationFlowStep?.descripcion ?? null,
      evaluationFlowOrderId,
      nombreCompleto: `${row.nombre} ${row.apellidos}`.trim(),
      canEvaluar: evaluationFlowOrderId === 5 || evaluationFlowOrderId === 6,
      evaluadorAsignadoEmail,
    };
  }
}
