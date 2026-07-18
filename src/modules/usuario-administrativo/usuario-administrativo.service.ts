import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsuarioAdministrativo } from './entities/usuario-administrativo.entity';
import { EvaluadorTenant } from './entities/evaluador-tenant.entity';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';
import { EvaluadorResponseDto } from './dto/evaluador-response.dto';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import { Hospital } from '../hospital/hospital.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UsuarioAdministrativoService {
  private readonly logger = new Logger(UsuarioAdministrativoService.name);

  constructor(
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
    @InjectRepository(EvaluadorTenant)
    private readonly evaluadorTenantRepository: Repository<EvaluadorTenant>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {}

  private assertAdministrador(user: JwtPayloadAdmin): void {
    if (user.rol !== RolUsuarioAdmin.Administrador) {
      throw new ForbiddenException(
        'Solo los administradores pueden gestionar evaluadores',
      );
    }
  }

  private toEvaluadorResponse(
    usuario: Pick<
      UsuarioAdministrativo,
      | 'id'
      | 'email'
      | 'nombre'
      | 'firma'
      | 'cedulaProfesional'
      | 'rol'
      | 'isSuperuser'
      | 'active'
      | 'createdAt'
    >,
    tenantIds: string[],
  ): EvaluadorResponseDto {
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      firma: usuario.firma,
      cedulaProfesional: usuario.cedulaProfesional,
      rol: usuario.rol,
      isSuperuser: usuario.isSuperuser,
      active: usuario.active,
      tenantIds,
      createdAt: usuario.createdAt,
    };
  }

  async findAllEvaluadores(
    user: JwtPayloadAdmin,
    includeInactive = false,
  ): Promise<EvaluadorResponseDto[]> {
    this.assertAdministrador(user);

    const evaluadores = await this.usuarioRepository.find({
      where: {
        rol: RolUsuarioAdmin.Evaluador,
        ...(includeInactive ? {} : { active: true }),
      },
      select: [
        'id',
        'email',
        'nombre',
        'firma',
        'cedulaProfesional',
        'rol',
        'isSuperuser',
        'active',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });

    if (evaluadores.length === 0) {
      return [];
    }

    const usuarioIds = evaluadores.map((e) => e.id);
    const assignments = await this.evaluadorTenantRepository.find({
      where: { usuarioId: In(usuarioIds) },
      select: ['usuarioId', 'tenantId'],
    });

    const tenantsByUsuario = new Map<string, string[]>();
    for (const assignment of assignments) {
      const list = tenantsByUsuario.get(assignment.usuarioId) ?? [];
      list.push(assignment.tenantId);
      tenantsByUsuario.set(assignment.usuarioId, list);
    }

    return evaluadores.map((evaluador) =>
      this.toEvaluadorResponse(
        evaluador,
        tenantsByUsuario.get(evaluador.id) ?? [],
      ),
    );
  }

  async createEvaluador(
    dto: CreateEvaluadorDto,
    user: JwtPayloadAdmin,
  ): Promise<EvaluadorResponseDto> {
    this.assertAdministrador(user);

    const email = dto.email.trim().toLowerCase();
    const tenantIds = [...new Set(dto.tenantIds.map((id) => id.trim()))];

    const existing = await this.usuarioRepository.findOne({
      where: { email },
      select: ['id'],
    });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con este email');
    }

    const hospitals = await this.hospitalRepository.find({
      where: { uuid: In(tenantIds), active: true },
      select: ['uuid'],
    });
    if (hospitals.length !== tenantIds.length) {
      const found = new Set(hospitals.map((h) => h.uuid));
      const missing = tenantIds.filter((id) => !found.has(id));
      throw new BadRequestException(
        `Hospital(es) no encontrado(s) o inactivo(s): ${missing.join(', ')}`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const nombre = dto.nombre.trim();
    const firma =
      dto.firma == null || dto.firma.trim() === '' ? null : dto.firma.trim();
    const cedulaProfesional =
      dto.cedulaProfesional == null || dto.cedulaProfesional.trim() === ''
        ? null
        : dto.cedulaProfesional.trim();

    const created = await this.dataSource.transaction(async (manager) => {
      const usuarioRepo = manager.getRepository(UsuarioAdministrativo);
      const evaluadorTenantRepo = manager.getRepository(EvaluadorTenant);

      const saved = await usuarioRepo.save(
        usuarioRepo.create({
          email,
          passwordHash,
          nombre,
          firma,
          cedulaProfesional,
          rol: RolUsuarioAdmin.Evaluador,
          isSuperuser: false,
          active: true,
        }),
      );

      await evaluadorTenantRepo.save(
        tenantIds.map((tenantId) =>
          evaluadorTenantRepo.create({
            usuarioId: saved.id,
            tenantId,
          }),
        ),
      );

      return this.toEvaluadorResponse(saved, tenantIds);
    });

    let emailEnviado = true;
    try {
      await this.mailService.sendEvaluadorRegistroEmail({
        email,
        nombre,
        password: dto.password,
      });
    } catch (err) {
      emailEnviado = false;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Fallo envío correo registro evaluador (${created.id}): ${errorMessage}`,
      );
      try {
        await this.mailService.sendEvaluadorMailFailureAlert({
          evaluadorId: created.id,
          evaluadorEmail: created.email,
          errorMessage,
        });
      } catch (alertErr) {
        const alertMessage =
          alertErr instanceof Error ? alertErr.message : String(alertErr);
        this.logger.error(
          `Fallo envío alerta admin por correo (evaluador ${created.id}): ${alertMessage}`,
        );
      }
    }

    return { ...created, emailEnviado };
  }
}
