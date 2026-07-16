import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Aspirante } from '../aspirante/aspirante.entity';
import { EvaluationFlowStep } from '../aspirante/evaluation-flow-step.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { EvaluadorTenant } from '../usuario-administrativo/entities/evaluador-tenant.entity';
import { Hospital } from '../hospital/hospital.entity';
import {
  assertTenantAccessWindow,
  resolveAspiranteJwtExpiresIn,
} from '../hospital/tenant-access-window';
import { MailService } from '../mail/mail.service';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import {
  JwtPayloadAdmin,
  JwtPayloadAspirante,
} from '../../common/interfaces/jwt-payload.interface';
import { getRequestId } from '../../common/request-context';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AspiranteLoginDto } from './dto/aspirante-login.dto';
import { ActivarCuentaDto } from './dto/activar-cuenta.dto';
import { SolicitarActivacionDto } from './dto/solicitar-activacion.dto';
import {
  SolicitarActivacionEstado,
  SolicitarActivacionResponseDto,
} from './dto/solicitar-activacion-response.dto';

const CREDENTIALS_ERROR = 'Credenciales inválidas';
const ACTIVACION_ERROR = 'No se pudo completar la operación';

function withReqId(message: string): string {
  const reqId = getRequestId();
  return reqId ? `reqId=${reqId} ${message}` : message;
}
/** Redacta token para logs: prefijo/sufijo + longitud (suficiente para cruzar con DB). */
function maskToken(token: string): string {
  if (!token) return '(vacío)';
  const len = token.length;
  if (len < 16) return `(len=${len})***`;
  return `${token.slice(0, 12)}...${token.slice(-8)} (len=${len})`;
}

function tokenFingerprint(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
}

function formatAspiranteLog(
  aspirante: Pick<
    Aspirante,
    | 'id'
    | 'email'
    | 'registroHospital'
    | 'active'
    | 'tenantId'
    | 'primerAccesoExpira'
    | 'evaluationFlowId'
  >,
): string {
  const expira = aspirante.primerAccesoExpira
    ? aspirante.primerAccesoExpira.toISOString()
    : '(null)';
  return [
    `id=${aspirante.id}`,
    `email=${aspirante.email}`,
    `registro=${aspirante.registroHospital}`,
    `active=${aspirante.active}`,
    `tenantId=${aspirante.tenantId}`,
    `flowId=${aspirante.evaluationFlowId}`,
    `expira=${expira}`,
  ].join(' ');
}

// Hash bcrypt válido de "dummy" para mitigar timing attacks cuando el usuario no existe
const DUMMY_HASH = bcrypt.hashSync('dummy', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
    @InjectRepository(EvaluadorTenant)
    private readonly evaluadorTenantRepository: Repository<EvaluadorTenant>,
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    @InjectRepository(EvaluationFlowStep)
    private readonly evaluationFlowStepRepository: Repository<EvaluationFlowStep>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
  ) {}

  async loginAdmin(dto: AdminLoginDto): Promise<{ accessToken: string; expiresIn: string }> {
    const usuario = await this.usuarioRepository.findOne({
      where: { email: dto.email.toLowerCase(), active: true },
      select: ['id', 'email', 'passwordHash', 'rol', 'isSuperuser', 'firma'],
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
      signature: usuario.firma != null && usuario.firma !== '',
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
      select: ['uuid', 'slug', 'accesoAbreAt', 'accesoCierraAt'],
    });

    if (!hospital) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException(CREDENTIALS_ERROR);
    }

    assertTenantAccessWindow(hospital);

    const aspirante = await this.aspiranteRepository.findOne({
      where: {
        tenantId: hospital.uuid,
        email: dto.email.toLowerCase(),
        registroHospital: dto.registroHospital,
        active: true,
      },
      relations: ['evaluationFlowStep'],
    });

    const passwordToCheck = aspirante?.passwordHash ?? DUMMY_HASH;
    const isValid = await bcrypt.compare(dto.password, passwordToCheck);

    if (!aspirante || !isValid) {
      throw new UnauthorizedException(CREDENTIALS_ERROR);
    }

    if (!aspirante.evaluationFlowStep) {
      throw new InternalServerErrorException(
        'Aspirante sin paso de flujo asignado; ejecute las migraciones del catálogo evaluation_flow_steps',
      );
    }

    return this.issueAspiranteAccessToken({
      aspirante,
      hospitalSlug: hospital.slug,
      accesoCierraAt: hospital.accesoCierraAt,
      flowStep: aspirante.evaluationFlowStep,
    });
  }

  /**
   * Firma un JWT de aspirante con order_id y descripción del paso actual.
   * TTL: 1d while tenant access is open (or no close date); 1h after close.
   * Reutilizar tras login, activar cuenta, avanzar/retroceder paso, etc.
   */
  issueAspiranteAccessToken(params: {
    aspirante: Pick<
      Aspirante,
      'id' | 'tenantId' | 'registroHospital' | 'nombre' | 'apellidos'
    >;
    hospitalSlug: string;
    accesoCierraAt: Date | null;
    flowStep: Pick<EvaluationFlowStep, 'orderId' | 'descripcion'>;
  }): { accessToken: string; expiresIn: string } {
    const fullName = `${params.aspirante.nombre} ${params.aspirante.apellidos}`.trim();
    const payload: JwtPayloadAspirante = {
      sub: params.aspirante.id,
      type: 'aspirante',
      tenantId: params.aspirante.tenantId,
      slug: params.hospitalSlug,
      registro: params.aspirante.registroHospital,
      nombre: fullName,
      evaluationFlowOrderId: params.flowStep.orderId,
      evaluationFlowDescripcion: params.flowStep.descripcion,
    };
    const expiresIn = resolveAspiranteJwtExpiresIn({
      accesoCierraAt: params.accesoCierraAt,
    });
    const accessToken = this.jwtService.sign(payload, { expiresIn });
    return { accessToken, expiresIn };
  }

  async solicitarActivacion(
    dto: SolicitarActivacionDto,
  ): Promise<SolicitarActivacionResponseDto> {
    const slug = dto.slug.trim();
    const email = dto.email.toLowerCase().trim();
    const registroHospital = dto.registroHospital.trim();

    const hospital = await this.hospitalRepository.findOne({
      where: { slug, active: true },
    });
    if (!hospital) {
      return {
        estado: SolicitarActivacionEstado.NoEncontrado,
        mensaje: 'No encontramos un aspirante con esos datos en este hospital.',
      };
    }

    assertTenantAccessWindow(hospital);

    const aspirante = await this.aspiranteRepository.findOne({
      where: {
        tenantId: hospital.uuid,
        email,
        registroHospital,
      },
    });

    if (!aspirante) {
      return {
        estado: SolicitarActivacionEstado.NoEncontrado,
        mensaje: 'No encontramos un aspirante con esos datos en este hospital.',
      };
    }

    if (aspirante.active) {
      return {
        estado: SolicitarActivacionEstado.YaActivo,
        mensaje: 'Tu cuenta ya está activa. Inicia sesión con tu correo y contraseña.',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    aspirante.primerAccesoToken = token;
    aspirante.primerAccesoExpira = expira;
    await this.aspiranteRepository.save(aspirante);

    try {
      await this.mailService.sendActivarCuentaEmail(aspirante, token, hospital);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        withReqId(
          `Fallo envío correo activar cuenta (aspirante ${aspirante.id}): ${errorMessage}`,
        ),
      );
      try {
        await this.mailService.sendAdminMailFailureAlert({
          aspiranteId: aspirante.id,
          aspiranteEmail: aspirante.email,
          hospitalNombre: hospital.nombre,
          errorMessage,
        });
      } catch (alertErr) {
        const alertMessage =
          alertErr instanceof Error ? alertErr.message : String(alertErr);
        this.logger.error(
          withReqId(
            `Fallo envío alerta admin por correo (aspirante ${aspirante.id}): ${alertMessage}`,
          ),
        );
      }
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo de activación. Intenta de nuevo más tarde.',
      );
    }

    return {
      estado: SolicitarActivacionEstado.ActivacionEnviada,
      mensaje:
        'Enviamos un correo para activar tu cuenta. Revisa tu bandeja de entrada.',
    };
  }

  async validarToken(
    token: string,
    slug: string,
  ): Promise<{ valido: true; hospitalNombre: string; slug: string } | { valido: false }> {
    const rawToken = token ?? '';
    const rawSlug = slug ?? '';
    const trimmedToken = rawToken.trim();
    const trimmedSlug = rawSlug.trim();

    this.logger.log(
      withReqId(
        `[validarToken] Inicio - slug=${trimmedSlug || '(vacío)'} ` +
          `token=${maskToken(trimmedToken)} fp=${trimmedToken ? tokenFingerprint(trimmedToken) : '(n/a)'} ` +
          `hadWhitespace=${rawToken !== trimmedToken}`,
      ),
    );

    if (!trimmedToken || !trimmedSlug) {
      this.logger.warn(
        withReqId(
          `[validarToken] Rechazado: token o slug vacíos ` +
            `(tokenEmpty=${!trimmedToken} slugEmpty=${!trimmedSlug})`,
        ),
      );
      return { valido: false };
    }

    const aspirante = await this.aspiranteRepository.findOne({
      where: {
        primerAccesoToken: trimmedToken,
      },
    });

    if (!aspirante) {
      await this.logPrimerAccesoTokenMiss('validarToken', trimmedToken, trimmedSlug);
      return { valido: false };
    }

    if (!aspirante.primerAccesoExpira) {
      this.logger.warn(
        withReqId(
          `[validarToken] Rechazado: aspirante sin primerAccesoExpira - ${formatAspiranteLog(aspirante)}`,
        ),
      );
      return { valido: false };
    }

    if (aspirante.primerAccesoExpira <= new Date()) {
      this.logger.warn(
        withReqId(
          `[validarToken] Rechazado: token expirado - ${formatAspiranteLog(aspirante)}`,
        ),
      );
      return { valido: false };
    }

    const hospital = await this.hospitalRepository.findOne({
      where: { uuid: aspirante.tenantId, slug: trimmedSlug },
    });
    if (!hospital || hospital.uuid !== aspirante.tenantId) {
      const hospitalBySlug = await this.hospitalRepository.findOne({
        where: { slug: trimmedSlug },
        select: ['uuid', 'slug', 'nombre'],
      });
      this.logger.warn(
        withReqId(
          `[validarToken] Rechazado: slug no coincide con tenant del token - ` +
            `${formatAspiranteLog(aspirante)} slugRecibido=${trimmedSlug} ` +
            `hospitalPorSlug=${
              hospitalBySlug
                ? `${hospitalBySlug.slug}/${hospitalBySlug.uuid}`
                : '(no existe)'
            }`,
        ),
      );
      return { valido: false };
    }

    assertTenantAccessWindow(hospital);

    this.logger.log(
      withReqId(
        `[validarToken] OK - ${formatAspiranteLog(aspirante)} hospital=${hospital.nombre}`,
      ),
    );
    return {
      valido: true,
      hospitalNombre: hospital.nombre,
      slug: hospital.slug,
    };
  }

  /**
   * Diagnóstico cuando no hay match exacto de primer_acceso_token.
   * No imprime el token completo; sí fingerprint, hospital y candidatos por prefijo.
   */
  private async logPrimerAccesoTokenMiss(
    context: string,
    trimmedToken: string,
    trimmedSlug: string,
  ): Promise<void> {
    const hospital = await this.hospitalRepository.findOne({
      where: { slug: trimmedSlug },
      select: ['uuid', 'slug', 'nombre', 'active'],
    });

    let pendingTokensForHospital = 0;
    let prefixMatches: Array<{
      id: string;
      email: string;
      active: boolean;
      primerAccesoExpira: Date | null;
      tokenMask: string;
    }> = [];

    if (hospital) {
      pendingTokensForHospital = await this.aspiranteRepository.count({
        where: {
          tenantId: hospital.uuid,
          primerAccesoToken: Not(IsNull()),
        },
      });

      const prefix = trimmedToken.slice(0, 12);
      if (prefix.length >= 8) {
        const candidates = await this.aspiranteRepository
          .createQueryBuilder('a')
          .select([
            'a.id',
            'a.email',
            'a.active',
            'a.primerAccesoExpira',
            'a.primerAccesoToken',
          ])
          .where('a.tenant_id = :tenantId', { tenantId: hospital.uuid })
          .andWhere('a.primer_acceso_token IS NOT NULL')
          .andWhere('a.primer_acceso_token LIKE :prefix', {
            prefix: `${prefix}%`,
          })
          .take(5)
          .getMany();

        prefixMatches = candidates.map((c) => ({
          id: c.id,
          email: c.email,
          active: c.active,
          primerAccesoExpira: c.primerAccesoExpira,
          tokenMask: maskToken(c.primerAccesoToken ?? ''),
        }));
      }
    }

    this.logger.warn(
      withReqId(
        `[${context}] Rechazado: aspirante no encontrado para token - ` +
          `token=${maskToken(trimmedToken)} fp=${tokenFingerprint(trimmedToken)} ` +
          `slug=${trimmedSlug} hospital=${
            hospital
              ? `${hospital.nombre} uuid=${hospital.uuid} active=${hospital.active}`
              : '(slug no existe)'
          } ` +
          `aspirantesConTokenPendiente=${pendingTokensForHospital} ` +
          `matchesPorPrefijo=${prefixMatches.length}` +
          (prefixMatches.length
            ? ` detalle=${JSON.stringify(
                prefixMatches.map((m) => ({
                  id: m.id,
                  email: m.email,
                  active: m.active,
                  expira: m.primerAccesoExpira?.toISOString() ?? null,
                  token: m.tokenMask,
                })),
              )}`
            : ''),
      ),
    );
  }

  async activarCuenta(
    dto: ActivarCuentaDto,
  ): Promise<{ mensaje: string; accessToken?: string; expiresIn?: string }> {
    const trimmedToken = dto.token.trim();
    const trimmedSlug = dto.slug.trim();
    this.logger.log(
      withReqId(
        `[activarCuenta] Inicio - slug=${trimmedSlug} ` +
          `token=${maskToken(trimmedToken)} fp=${tokenFingerprint(trimmedToken)} ` +
          `registro=${dto.registroHospital.trim()}`,
      ),
    );

    const aspirante = await this.aspiranteRepository.findOne({
      where: {
        primerAccesoToken: trimmedToken,
      },
    });

    if (!aspirante) {
      await this.logPrimerAccesoTokenMiss('activarCuenta', trimmedToken, trimmedSlug);
      throw new BadRequestException(ACTIVACION_ERROR);
    }

    if (
      !aspirante.primerAccesoExpira ||
      aspirante.primerAccesoExpira <= new Date()
    ) {
      this.logger.warn(
        withReqId(
          `[activarCuenta] Rechazado: token inválido o expirado - ${formatAspiranteLog(aspirante)}`,
        ),
      );
      throw new BadRequestException(ACTIVACION_ERROR);
    }

    const hospital = await this.hospitalRepository.findOne({
      where: { uuid: aspirante.tenantId, slug: trimmedSlug },
    });
    if (!hospital || hospital.uuid !== aspirante.tenantId) {
      this.logger.warn(
        withReqId(
          `[activarCuenta] Rechazado: slug no coincide - ${formatAspiranteLog(aspirante)} ` +
            `slugRecibido=${trimmedSlug}`,
        ),
      );
      throw new BadRequestException(ACTIVACION_ERROR);
    }

    assertTenantAccessWindow(hospital);

    if (aspirante.registroHospital.trim() !== dto.registroHospital.trim()) {
      this.logger.warn(
        withReqId(
          `[activarCuenta] Rechazado: registroHospital no coincide - ` +
            `${formatAspiranteLog(aspirante)} registroRecibido=${dto.registroHospital.trim()}`,
        ),
      );
      throw new BadRequestException(ACTIVACION_ERROR);
    }

    this.logger.log(
      withReqId(
        `[activarCuenta] Validación OK - activando ${formatAspiranteLog(aspirante)}`,
      ),
    );

    const pasoRegistrado = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: 2 },
    });
    if (!pasoRegistrado) {
      this.logger.error(
        withReqId(
          '[activarCuenta] Falta paso evaluation_flow_steps con order_id = 2',
        ),
      );
      throw new InternalServerErrorException(
        'Catálogo evaluation_flow_steps no inicializado (falta paso order_id = 2)',
      );
    }

    aspirante.passwordHash = await bcrypt.hash(dto.password, 10);
    aspirante.genero = dto.genero;
    aspirante.fechaNacimiento = dto.fechaNacimiento;
    aspirante.active = true;
    aspirante.primerAccesoToken = null;
    aspirante.primerAccesoExpira = null;
    aspirante.evaluationFlowId = pasoRegistrado.id;
    await this.aspiranteRepository.save(aspirante);

    this.logger.log(
      withReqId(
        `[activarCuenta] Cuenta activada - aspirante=${aspirante.id} email=${aspirante.email} hospital=${hospital.nombre}`,
      ),
    );

    const tokenBundle = this.issueAspiranteAccessToken({
      aspirante,
      hospitalSlug: hospital.slug,
      accesoCierraAt: hospital.accesoCierraAt,
      flowStep: pasoRegistrado,
    });

    return {
      mensaje: 'Cuenta activada correctamente',
      ...tokenBundle,
    };
  }

  async nextFlowStep(
    user: JwtPayloadAspirante,
  ): Promise<
    | { flowUpdated: true; accessToken: string; expiresIn: string }
    | { flowUpdated: false; reason: 'END_OF_FLOW' }
  > {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: user.sub },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante?.evaluationFlowStep) {
      throw new BadRequestException('Aspirante o paso de flujo no encontrado');
    }

    if (aspirante.evaluationFlowStep.orderId === 2) {
      throw new BadRequestException('Debes completar el pago antes de continuar');
    }

    const nextOrderId = aspirante.evaluationFlowStep.orderId + 1;
    const nextStep = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: nextOrderId },
    });
    if (!nextStep) {
      return { flowUpdated: false, reason: 'END_OF_FLOW' };
    }

    const updateResult = await this.aspiranteRepository.update(
      { id: aspirante.id },
      { evaluationFlowId: nextStep.id },
    );
    if (!updateResult.affected) {
      throw new InternalServerErrorException(
        'No se pudo actualizar el paso de flujo del aspirante',
      );
    }

    const hospital = await this.hospitalRepository.findOne({
      where: { uuid: aspirante.tenantId, active: true },
      select: ['slug', 'accesoCierraAt'],
    });
    if (!hospital) {
      throw new InternalServerErrorException('Hospital no encontrado');
    }

    return {
      flowUpdated: true,
      ...this.issueAspiranteAccessToken({
        aspirante,
        hospitalSlug: hospital.slug,
        accesoCierraAt: hospital.accesoCierraAt,
        flowStep: nextStep,
      }),
    };
  }

  async previousFlowStep(
    user: JwtPayloadAspirante,
  ): Promise<
    | { flowUpdated: true; accessToken: string; expiresIn: string }
    | { flowUpdated: false; reason: 'AT_BEGINNING' }
  > {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: user.sub },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante?.evaluationFlowStep) {
      throw new BadRequestException('Aspirante o paso de flujo no encontrado');
    }

    const prevOrderId = aspirante.evaluationFlowStep.orderId - 1;
    if (prevOrderId < 1) {
      return { flowUpdated: false, reason: 'AT_BEGINNING' };
    }

    const prevStep = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: prevOrderId },
    });
    if (!prevStep) {
      throw new BadRequestException(
        'No existe un paso configurado para el orden anterior en el catálogo',
      );
    }

    const updateResult = await this.aspiranteRepository.update(
      { id: aspirante.id },
      { evaluationFlowId: prevStep.id },
    );
    if (!updateResult.affected) {
      throw new InternalServerErrorException(
        'No se pudo actualizar el paso de flujo del aspirante',
      );
    }

    const hospital = await this.hospitalRepository.findOne({
      where: { uuid: aspirante.tenantId, active: true },
      select: ['slug', 'accesoCierraAt'],
    });
    if (!hospital) {
      throw new InternalServerErrorException('Hospital no encontrado');
    }

    return {
      flowUpdated: true,
      ...this.issueAspiranteAccessToken({
        aspirante,
        hospitalSlug: hospital.slug,
        accesoCierraAt: hospital.accesoCierraAt,
        flowStep: prevStep,
      }),
    };
  }
}
