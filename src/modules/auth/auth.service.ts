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
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Aspirante } from '../aspirante/aspirante.entity';
import { EvaluationFlowStep } from '../aspirante/evaluation-flow-step.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { EvaluadorTenant } from '../usuario-administrativo/entities/evaluador-tenant.entity';
import { Hospital } from '../hospital/hospital.entity';
import { MailService } from '../mail/mail.service';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import {
  JwtPayloadAdmin,
  JwtPayloadAspirante,
} from '../../common/interfaces/jwt-payload.interface';
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
      flowStep: aspirante.evaluationFlowStep,
    });
  }

  /**
   * Firma un JWT de aspirante con order_id y descripción del paso actual.
   * Reutilizar tras login, activar cuenta, avanzar/retroceder paso, etc.
   */
  issueAspiranteAccessToken(params: {
    aspirante: Pick<
      Aspirante,
      'id' | 'tenantId' | 'registroHospital' | 'nombre' | 'apellidos'
    >;
    hospitalSlug: string;
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
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
    const accessToken = this.jwtService.sign(payload);
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
        `Fallo envío correo activar cuenta (aspirante ${aspirante.id}): ${errorMessage}`,
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
          `Fallo envío alerta admin por correo (aspirante ${aspirante.id}): ${alertMessage}`,
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

    if (aspirante.registroHospital.trim() !== dto.registroHospital.trim()) {
      this.logger.warn(`[activarCuenta] Rechazado: registroHospital no coincide`);
      throw new BadRequestException(ACTIVACION_ERROR);
    }

    this.logger.log(`[activarCuenta] Validación OK - activando aspirante=${aspirante.id}`);

    const pasoRegistrado = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: 2 },
    });
    if (!pasoRegistrado) {
      this.logger.error('[activarCuenta] Falta paso evaluation_flow_steps con order_id = 2');
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

    this.logger.log(`[activarCuenta] Cuenta activada - aspirante=${aspirante.id} hospital=${hospital.nombre}`);

    const tokenBundle = this.issueAspiranteAccessToken({
      aspirante,
      hospitalSlug: hospital.slug,
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
      select: ['slug'],
    });
    if (!hospital) {
      throw new InternalServerErrorException('Hospital no encontrado');
    }

    return {
      flowUpdated: true,
      ...this.issueAspiranteAccessToken({
        aspirante,
        hospitalSlug: hospital.slug,
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
      select: ['slug'],
    });
    if (!hospital) {
      throw new InternalServerErrorException('Hospital no encontrado');
    }

    return {
      flowUpdated: true,
      ...this.issueAspiranteAccessToken({
        aspirante,
        hospitalSlug: hospital.slug,
        flowStep: prevStep,
      }),
    };
  }
}
