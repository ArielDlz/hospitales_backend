import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Aspirante } from '../aspirante/aspirante.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { EvaluadorTenant } from '../usuario-administrativo/entities/evaluador-tenant.entity';
import { Hospital } from '../hospital/hospital.entity';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import {
  JwtPayloadAdmin,
  JwtPayloadAspirante,
} from '../../common/interfaces/jwt-payload.interface';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AspiranteLoginDto } from './dto/aspirante-login.dto';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';

const CREDENTIALS_ERROR = 'Credenciales inválidas';
const ACTIVACION_ERROR = 'No se pudo completar la operación';

/** Redacta token para logs: solo primeros/últimos 4 chars */
function maskToken(token: string): string {
  if (!token || token.length < 12) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

// Hash bcrypt válido de "dummy" para mitigar timing attacks cuando el usuario no existe
const DUMMY_HASH = bcrypt.hashSync('dummy', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
    @InjectRepository(EvaluadorTenant)
    private readonly evaluadorTenantRepository: Repository<EvaluadorTenant>,
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
  ) {}

  async loginAdmin(dto: AdminLoginDto): Promise<{ accessToken: string; expiresIn: string }> {
    const usuario = await this.usuarioRepository.findOne({
      where: { email: dto.email.toLowerCase(), active: true },
      select: ['id', 'email', 'passwordHash', 'rol', 'isSuperuser'],
    });

    const passwordToCheck = usuario?.passwordHash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(dto.password, passwordToCheck);

    if (!usuario || !isValid) {
      throw new UnauthorizedException(CREDENTIALS_ERROR);
    }

    let tenants: string[] | undefined;

    if (usuario.rol === RolUsuarioAdmin.Evaluador) {
      const assignments = await this.evaluadorTenantRepository.find({
        where: { usuarioId: usuario.id },
        select: ['tenantId'],
      });
      tenants = assignments.length > 0 ? assignments.map((a) => a.tenantId) : undefined;
    }

    const payload: JwtPayloadAdmin = {
      sub: usuario.id,
      type: 'admin',
      rol: usuario.rol,
      tenants,
    };

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, expiresIn };
  }

  async loginAspirante(
    dto: AspiranteLoginDto,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    const hospital = await this.hospitalRepository.findOne({
      where: { slug: dto.slug, active: true },
      select: ['uuid', 'slug'],
    });

    if (!hospital) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException(CREDENTIALS_ERROR);
    }

    const aspirante = await this.aspiranteRepository.findOne({
      where: {
        tenantId: hospital.uuid,
        email: dto.email.toLowerCase(),
        registroHospital: dto.registroHospital,
        active: true,
      },
      select: ['id', 'tenantId', 'email', 'registroHospital', 'passwordHash', 'nombre', 'apellidos'],
    });

    const passwordToCheck = aspirante?.passwordHash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(dto.password, passwordToCheck);

    if (!aspirante || !isValid) {
      throw new UnauthorizedException(CREDENTIALS_ERROR);
    }

    const fullName = `${aspirante.nombre} ${aspirante.apellidos}`.trim();
    const payload: JwtPayloadAspirante = {
      sub: aspirante.id,
      type: 'aspirante',
      tenantId: aspirante.tenantId,
      slug: hospital.slug,
      registro: aspirante.registroHospital,
      nombre: fullName,
    };

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, expiresIn };
  }

  async validarToken(
    token: string,
    slug: string,
  ): Promise<{ valido: true; hospitalNombre: string; slug: string } | { valido: false }> {
    this.logger.log(`[validarToken] Inicio - slug=${slug?.trim() || '(vacío)'} token=${maskToken(token || '')}`);

    if (!token?.trim() || !slug?.trim()) {
      this.logger.warn(`[validarToken] Rechazado: token o slug vacíos`);
      return { valido: false };
    }

    const aspirante = await this.aspiranteRepository.findOne({
      where: {
        primerAccesoToken: token.trim(),
      },
    });

    if (!aspirante || !aspirante.primerAccesoExpira) {
      this.logger.warn(`[validarToken] Rechazado: aspirante no encontrado para token`);
      return { valido: false };
    }
    if (aspirante.primerAccesoExpira <= new Date()) {
      this.logger.warn(`[validarToken] Rechazado: token expirado (expira=${aspirante.primerAccesoExpira.toISOString()})`);
      return { valido: false };
    }

    const hospital = await this.hospitalRepository.findOne({
      where: { uuid: aspirante.tenantId, slug: slug.trim() },
    });
    if (!hospital || hospital.uuid !== aspirante.tenantId) {
      this.logger.warn(`[validarToken] Rechazado: slug no coincide con tenant del token (slug recibido=${slug.trim()}, tenant aspirante=${aspirante.tenantId})`);
      return { valido: false };
    }

    this.logger.log(`[validarToken] OK - aspirante=${aspirante.id} hospital=${hospital.nombre}`);
    return {
      valido: true,
      hospitalNombre: hospital.nombre,
      slug: hospital.slug,
    };
  }

  async activarCuenta(
    dto: ActivarCuentaDto,
  ): Promise<{ mensaje: string; accessToken?: string; expiresIn?: string }> {
    this.logger.log(`[activarCuenta] Inicio - slug=${dto.slug} token=${maskToken(dto.token)}`);

    const aspirante = await this.aspiranteRepository.findOne({
      where: {
        primerAccesoToken: dto.token.trim(),
      },
    });

    if (
      !aspirante ||
      !aspirante.primerAccesoExpira ||
      aspirante.primerAccesoExpira <= new Date()
    ) {
      this.logger.warn(`[activarCuenta] Rechazado: token inválido o expirado (aspirante encontrado=${!!aspirante})`);
      throw new BadRequestException(ACTIVACION_ERROR);
    }

    const hospital = await this.hospitalRepository.findOne({
      where: { uuid: aspirante.tenantId, slug: dto.slug.trim() },
    });
    if (!hospital || hospital.uuid !== aspirante.tenantId) {
      this.logger.warn(`[activarCuenta] Rechazado: slug no coincide (slug=${dto.slug} tenant=${aspirante.tenantId})`);
      throw new BadRequestException(ACTIVACION_ERROR);
    }

    const normalizeStr = (s: string) => s.trim().toLowerCase();
    const normalizeTel = (s: string) => s.replace(/\D/g, '');

    const nombreOk = normalizeStr(aspirante.nombre) === normalizeStr(dto.nombre);
    const apellidosOk =
      normalizeStr(aspirante.apellidos) === normalizeStr(dto.apellidos);
    const registroOk =
      aspirante.registroHospital.trim() === dto.registroHospital.trim();

    if (aspirante.telefono === null) {
      if (dto.telefono?.trim()) {
        this.logger.warn(`[activarCuenta] Rechazado: aspirante sin teléfono en BD pero envió uno`);
        throw new BadRequestException(ACTIVACION_ERROR);
      }
    } else {
      if (!dto.telefono?.trim()) {
        this.logger.warn(`[activarCuenta] Rechazado: aspirante tiene teléfono en BD pero no envió`);
        throw new BadRequestException(ACTIVACION_ERROR);
      }
      if (normalizeTel(aspirante.telefono) !== normalizeTel(dto.telefono)) {
        this.logger.warn(`[activarCuenta] Rechazado: teléfono no coincide`);
        throw new BadRequestException(ACTIVACION_ERROR);
      }
    }

    if (!nombreOk || !apellidosOk || !registroOk) {
      this.logger.warn(`[activarCuenta] Rechazado: nombre/apellidos/registro no coinciden (nombreOk=${nombreOk} apellidosOk=${apellidosOk} registroOk=${registroOk})`);
      throw new BadRequestException(ACTIVACION_ERROR);
    }

    this.logger.log(`[activarCuenta] Validación OK - activando aspirante=${aspirante.id}`);
    aspirante.passwordHash = await bcrypt.hash(dto.password, 10);
    aspirante.active = true;
    aspirante.primerAccesoToken = null;
    aspirante.primerAccesoExpira = null;
    await this.aspiranteRepository.save(aspirante);

    this.logger.log(`[activarCuenta] Cuenta activada - aspirante=${aspirante.id} hospital=${hospital.nombre}`);
    const fullName = `${aspirante.nombre} ${aspirante.apellidos}`.trim();
    const payload: JwtPayloadAspirante = {
      sub: aspirante.id,
      type: 'aspirante',
      tenantId: aspirante.tenantId,
      slug: hospital.slug,
      registro: aspirante.registroHospital,
      nombre: fullName,
    };
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
    const accessToken = this.jwtService.sign(payload);

    return {
      mensaje: 'Cuenta activada correctamente',
      accessToken,
      expiresIn,
    };
  }
}
