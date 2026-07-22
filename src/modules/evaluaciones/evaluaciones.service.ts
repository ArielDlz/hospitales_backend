import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Aspirante } from '../aspirante/aspirante.entity';
import { EvaluationFlowService } from '../aspirante/evaluation-flow.service';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import {
  ProcesoPrueba,
  PruebaAspirante,
} from '../pruebas/entities/prueba-aspirante.entity';
import { Prueba } from '../pruebas/entities/prueba.entity';
import { PruebasService } from '../pruebas/pruebas.service';
import { Veredicto } from './entities/veredicto.entity';
import { AspiranteEvaluacion } from './entities/aspirante-evaluacion.entity';
import { VeredictoResponseDto } from './dto/veredicto-response.dto';
import { EvaluacionWorkspaceResponseDto } from './dto/evaluacion-workspace-response.dto';
import { SubmitInformeDto } from './dto/submit-informe.dto';
import {
  AspiranteEvaluacionResponseDto,
  ConfirmarEvaluacionResponseDto,
} from './dto/aspirante-evaluacion-response.dto';
import { InformePdfService } from './informe-pdf.service';
import { FirmarInformeResponseDto } from './dto/firmar-informe-response.dto';
import { AsignarEvaluacionResponseDto } from './dto/asignar-evaluacion-response.dto';
import { Hospital } from '../hospital/hospital.entity';
import { S3StorageService } from '../storage/s3-storage.service';
import {
  buildInformeFirmadoFilename,
  resolveInformeFirmadoFilename,
} from './informe-firmado-filename.util';

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** Edad en años desde YYYY-MM-DD; null si falta o es inválida. */
function ageFromFechaNacimiento(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) {
    return null;
  }
  const match = ISO_DATE_PREFIX.exec(
    typeof fechaNacimiento === 'string'
      ? fechaNacimiento
      : String(fechaNacimiento),
  );
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

export interface InformePdfResult {
  buffer: Buffer;
  filename: string;
}

interface InformePdfContext {
  evaluacion: AspiranteEvaluacion;
  veredicto: Veredicto;
  emailEvaluador: string;
}

const EVALUATION_QUEUE_ORDER_IDS = [5, 6];

@Injectable()
export class EvaluacionesService {
  constructor(
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    @InjectRepository(PruebaAspirante)
    private readonly pruebaAspiranteRepository: Repository<PruebaAspirante>,
    @InjectRepository(Prueba)
    private readonly pruebaRepository: Repository<Prueba>,
    @InjectRepository(Veredicto)
    private readonly veredictoRepository: Repository<Veredicto>,
    @InjectRepository(AspiranteEvaluacion)
    private readonly aspiranteEvaluacionRepository: Repository<AspiranteEvaluacion>,
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    private readonly pruebasService: PruebasService,
    private readonly evaluationFlowService: EvaluationFlowService,
    private readonly dataSource: DataSource,
    private readonly informePdfService: InformePdfService,
    private readonly s3Storage: S3StorageService,
  ) {}

  async findVeredictos(): Promise<VeredictoResponseDto[]> {
    const rows = await this.veredictoRepository.find({
      where: { active: true },
      order: { idVeredicto: 'ASC' },
    });
    return rows.map((v) => ({
      idVeredicto: v.idVeredicto,
      codigo: v.codigo,
      etiqueta: v.etiqueta,
    }));
  }

  async asignarEvaluacion(
    aspiranteId: string,
    user: JwtPayloadAdmin,
  ): Promise<AsignarEvaluacionResponseDto> {
    const { aspirante, readOnly } = await this.claimOrAssertAssignment(
      aspiranteId,
      user,
    );

    const orderId = aspirante.evaluationFlowStep?.orderId ?? 0;
    const evaluadorAsignadoEmail = await this.resolveEvaluadorEmail(
      aspirante.idEvaluadorAsignado,
    );

    return {
      aspiranteId: aspirante.id,
      evaluationFlowOrderId: orderId,
      evaluationFlowDescripcion: aspirante.evaluationFlowStep?.descripcion ?? null,
      evaluadorAsignadoEmail,
      readOnly,
      message: readOnly
        ? 'Acceso de solo lectura'
        : 'Evaluación asignada correctamente',
    };
  }

  async getWorkspace(
    aspiranteId: string,
    user: JwtPayloadAdmin,
  ): Promise<EvaluacionWorkspaceResponseDto> {
    const { aspirante, readOnly } = await this.claimOrAssertAssignment(
      aspiranteId,
      user,
    );

    const intentos = await this.pruebaAspiranteRepository.find({
      where: { idAspirante: aspiranteId },
      order: { idPruebaAspirante: 'ASC' },
    });

    const idsPrueba = [...new Set(intentos.map((i) => i.idPrueba))];
    const pruebas = idsPrueba.length
      ? await this.pruebaRepository.find({
          where: { idPrueba: In(idsPrueba) },
          select: ['idPrueba', 'nombre'],
        })
      : [];
    const nombreByPrueba = new Map(pruebas.map((p) => [p.idPrueba, p.nombre]));

    const evaluacionAspirante = await this.loadEvaluacionAspiranteResponse(aspiranteId);
    const orderId = aspirante.evaluationFlowStep?.orderId ?? 0;
    const evaluadorAsignadoEmail = await this.resolveEvaluadorEmail(
      aspirante.idEvaluadorAsignado,
    );

    const intentosWorkspace = await Promise.all(
      intentos.map(async (intento) => {
        const base = {
          idPruebaAspirante: intento.idPruebaAspirante,
          idPrueba: intento.idPrueba,
          nombrePrueba:
            nombreByPrueba.get(intento.idPrueba) ?? `Prueba ${intento.idPrueba}`,
          status: intento.status,
          inicioAt: intento.inicioAt,
          finAt: intento.finAt,
        };

        const preguntasCatalogo =
          await this.pruebasService.buildPreguntasActivasByPrueba(intento.idPrueba);

        if (
          this.pruebasService.shouldUseWorkspaceResumenFormat(
            intento.idPrueba,
            preguntasCatalogo,
          )
        ) {
          const { preguntas, resumenEstadisticas } =
            await this.pruebasService.buildPreguntasResumenWorkspace(
              intento.idPruebaAspirante,
              intento.idPrueba,
            );
          return {
            ...base,
            formato: 'resumen' as const,
            resumenEstadisticas,
            preguntas,
          };
        }

        const respuestasEnriquecidas =
          await this.pruebasService.buildRespuestasEnriquecidas(
            intento.idPruebaAspirante,
            { resolveOptionLabels: true, evaluateCorrectness: true },
          );

        return {
          ...base,
          formato: 'completo' as const,
          preguntas: preguntasCatalogo,
          respuestas: (respuestasEnriquecidas?.respuestas ?? []).map((r) => {
            const item = {
              idPruebaRespuesta: r.idPruebaRespuesta,
              idPregunta: r.idPregunta,
              tipo: r.tipo,
              respuesta: r.respuesta as string | string[] | null,
            };
            if (r.esCorrecta !== undefined) {
              return { ...item, esCorrecta: r.esCorrecta };
            }
            return item;
          }),
        };
      }),
    );

    return {
      aspirante: {
        id: aspirante.id,
        nombreCompleto: `${aspirante.nombre} ${aspirante.apellidos}`.trim(),
        registroHospital: aspirante.registroHospital,
        email: aspirante.email,
        edad: ageFromFechaNacimiento(aspirante.fechaNacimiento),
        especialidad: aspirante.especialidad ?? null,
        evaluationFlowOrderId: orderId,
        evaluationFlowDescripcion: aspirante.evaluationFlowStep?.descripcion ?? null,
      },
      evaluacionAspirante,
      canConfirmarEvaluacion:
        !readOnly &&
        orderId === 6 &&
        evaluacionAspirante !== null &&
        evaluacionAspirante.confirmedAt === null,
      readOnly,
      evaluadorAsignadoEmail,
      intentos: intentosWorkspace,
    };
  }

  /** @deprecated Use informe final del aspirante (POST .../informe). */
  async upsertIntentoComentario(): Promise<never> {
    throw new GoneException(
      'Los comentarios por prueba ya no están soportados. Use el informe final del aspirante.',
    );
  }

  async submitInforme(
    aspiranteId: string,
    dto: SubmitInformeDto,
    user: JwtPayloadAdmin,
  ): Promise<AspiranteEvaluacionResponseDto> {
    const comentario = dto.comentario.trim();
    if (!comentario) {
      throw new BadRequestException('El comentario del informe no puede estar vacío');
    }

    const aspirante = await this.loadAspiranteWithFlow(aspiranteId);
    this.assertEvaluadorCanAccessAspirante(user, aspirante);
    this.assertCanEditEvaluation(user, aspirante);

    const orderId = aspirante.evaluationFlowStep?.orderId;
    if (orderId !== 6) {
      throw new BadRequestException(
        'El informe final solo puede enviarse cuando el aspirante está en evaluación en curso (paso 6)',
      );
    }

    const veredicto = await this.veredictoRepository.findOne({
      where: { idVeredicto: dto.idVeredicto, active: true },
    });
    if (!veredicto) {
      throw new BadRequestException('Veredicto no válido o inactivo');
    }

    const existente = await this.aspiranteEvaluacionRepository.findOne({
      where: { idAspirante: aspiranteId },
    });

    let saved: AspiranteEvaluacion;
    if (existente) {
      if (existente.confirmedAt) {
        throw new ConflictException('La evaluación ya fue confirmada');
      }
      existente.comentario = comentario;
      existente.idVeredicto = veredicto.idVeredicto;
      existente.idEvaluador = user.sub;
      saved = await this.aspiranteEvaluacionRepository.save(existente);
    } else {
      saved = await this.aspiranteEvaluacionRepository.save(
        this.aspiranteEvaluacionRepository.create({
          idAspirante: aspiranteId,
          idEvaluador: user.sub,
          idVeredicto: veredicto.idVeredicto,
          comentario,
          confirmedAt: null,
        }),
      );
    }

    return this.toEvaluacionAspiranteResponse(saved, veredicto);
  }

  async generateInformePdf(
    aspiranteId: string,
    user: JwtPayloadAdmin,
  ): Promise<InformePdfResult> {
    const aspirante = await this.loadAspiranteWithFlow(aspiranteId);
    this.assertEvaluadorCanAccessAspirante(user, aspirante);

    const { evaluacion, veredicto, emailEvaluador } =
      await this.loadInformePdfContext(aspiranteId);

    const buffer = await this.informePdfService.buildPdf({
      nombre: aspirante.nombre,
      apellidos: aspirante.apellidos,
      registroHospital: aspirante.registroHospital,
      especialidad: aspirante.especialidad,
      genero: aspirante.genero,
      fechaNacimiento: aspirante.fechaNacimiento,
      emailEvaluador,
      comentario: evaluacion.comentario,
      veredictoEtiqueta: veredicto.etiqueta,
      veredictoCodigo: veredicto.codigo,
      fechaInforme: new Date(),
    });

    const safeRegistro = aspirante.registroHospital.replace(/[^\w.-]+/g, '_');
    return {
      buffer,
      filename: `informe-${safeRegistro}.pdf`,
    };
  }

  async firmarInforme(
    aspiranteId: string,
    user: JwtPayloadAdmin,
  ): Promise<FirmarInformeResponseDto> {
    const aspirante = await this.loadAspiranteWithFlow(aspiranteId);
    await this.assertCanAccessForFirma(user, aspirante);

    const signer = await this.usuarioRepository.findOne({
      where: { id: user.sub },
      select: ['nombre', 'firma', 'email', 'cedulaProfesional'],
    });
    if (!signer?.firma?.trim()) {
      throw new ForbiddenException(
        'Solo usuarios con firma pueden firmar informes',
      );
    }

    const { evaluacion, veredicto, emailEvaluador } =
      await this.loadInformePdfContext(aspiranteId);

    const nombreFirmante = signer.nombre?.trim() || signer.email;
    const buffer = await this.informePdfService.buildPdf({
      nombre: aspirante.nombre,
      apellidos: aspirante.apellidos,
      registroHospital: aspirante.registroHospital,
      especialidad: aspirante.especialidad,
      genero: aspirante.genero,
      fechaNacimiento: aspirante.fechaNacimiento,
      emailEvaluador,
      comentario: evaluacion.comentario,
      veredictoEtiqueta: veredicto.etiqueta,
      veredictoCodigo: veredicto.codigo,
      fechaInforme: new Date(),
      firmaUrl: signer.firma,
      nombreFirmante,
      cedulaProfesional: signer.cedulaProfesional,
    });

    const filename = buildInformeFirmadoFilename(
      aspirante.documento,
      veredicto.codigo,
      veredicto.etiqueta,
    );
    const uploaded = await this.s3Storage.uploadBuffer({
      buffer,
      contentType: 'application/pdf',
      key: `informes-firmados/${filename}`,
    });

    await this.aspiranteRepository.update(
      { id: aspiranteId },
      { veredictoInforme: uploaded.url },
    );

    const flowAdvance = await this.evaluationFlowService.setFlowStepToOrderId(
      aspiranteId,
      10,
      'informe_firmado',
    );

    return {
      veredictoInforme: uploaded.url,
      message: 'Informe firmado correctamente',
      evaluationFlowOrderId: flowAdvance.newOrderId ?? 10,
    };
  }

  async downloadInformeFirmado(
    aspiranteId: string,
    user: JwtPayloadAdmin,
  ): Promise<InformePdfResult> {
    const aspirante = await this.loadAspiranteWithFlow(aspiranteId);
    await this.assertCanAccessForFirma(user, aspirante);

    if (!aspirante.veredictoInforme?.trim()) {
      throw new NotFoundException(
        'No existe un informe firmado para este aspirante',
      );
    }

    const response = await fetch(aspirante.veredictoInforme);
    if (!response.ok) {
      throw new ServiceUnavailableException(
        'No se pudo descargar el informe firmado desde el almacenamiento',
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    let veredictoCodigo: string | null = null;
    let veredictoEtiqueta: string | null = null;
    const evaluacion = await this.aspiranteEvaluacionRepository.findOne({
      where: { idAspirante: aspiranteId },
      select: ['idVeredicto'],
    });
    if (evaluacion?.idVeredicto != null) {
      const veredicto = await this.veredictoRepository.findOne({
        where: { idVeredicto: evaluacion.idVeredicto },
        select: ['codigo', 'etiqueta'],
      });
      veredictoCodigo = veredicto?.codigo ?? null;
      veredictoEtiqueta = veredicto?.etiqueta ?? null;
    }

    const filename = resolveInformeFirmadoFilename({
      documento: aspirante.documento,
      veredictoCodigo,
      veredictoEtiqueta,
      veredictoInformeUrl: aspirante.veredictoInforme,
    });

    return { buffer, filename };
  }

  async confirmarEvaluacion(
    aspiranteId: string,
    user: JwtPayloadAdmin,
  ): Promise<ConfirmarEvaluacionResponseDto> {
    const aspirante = await this.loadAspiranteWithFlow(aspiranteId);
    this.assertEvaluadorCanAccessAspirante(user, aspirante);
    this.assertCanEditEvaluation(user, aspirante);

    const orderId = aspirante.evaluationFlowStep?.orderId;
    if (orderId !== 6) {
      throw new BadRequestException(
        'Solo se puede confirmar la evaluación en el paso 6',
      );
    }

    const evaluacion = await this.aspiranteEvaluacionRepository.findOne({
      where: { idAspirante: aspiranteId },
    });
    if (!evaluacion) {
      throw new BadRequestException(
        'Debe existir un informe final antes de confirmar la evaluación',
      );
    }
    if (evaluacion.confirmedAt) {
      throw new ConflictException('La evaluación ya fue confirmada');
    }

    await this.dataSource.transaction(async (manager) => {
      const evalRepo = manager.getRepository(AspiranteEvaluacion);
      const intentoRepo = manager.getRepository(PruebaAspirante);

      evaluacion.confirmedAt = new Date();
      await evalRepo.save(evaluacion);

      await intentoRepo.update(
        { idAspirante: aspiranteId },
        { status: ProcesoPrueba.Evaluada },
      );
    });

    const advance = await this.evaluationFlowService.advanceOneStepIfAt(
      aspiranteId,
      6,
      'evaluacion_confirmada',
    );

    return {
      message: 'Evaluación confirmada correctamente',
      evaluationFlowOrderId: advance.newOrderId ?? 7,
    };
  }

  private async loadAspiranteWithFlow(aspiranteId: string): Promise<Aspirante> {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: aspiranteId },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante) {
      throw new NotFoundException(`Aspirante con id ${aspiranteId} no encontrado`);
    }
    return aspirante;
  }

  private async claimOrAssertAssignment(
    aspiranteId: string,
    user: JwtPayloadAdmin,
  ): Promise<{ aspirante: Aspirante; readOnly: boolean }> {
    let aspirante = await this.loadAspiranteWithFlow(aspiranteId);
    this.assertAspiranteEnColaEvaluacion(aspirante);

    if (user.rol === RolUsuarioAdmin.Evaluador) {
      if (
        aspirante.idEvaluadorAsignado &&
        aspirante.idEvaluadorAsignado !== user.sub
      ) {
        const isSupervisor = await this.isSupervisorOfAssignedEvaluador(
          user.sub,
          aspirante,
        );
        if (isSupervisor) {
          return { aspirante, readOnly: true };
        }
        this.assertEvaluadorCanAccessAspirante(user, aspirante);
        throw new ForbiddenException(
          'Este aspirante está siendo evaluado por otro evaluador',
        );
      }

      this.assertEvaluadorCanAccessAspirante(user, aspirante);

      if (!aspirante.idEvaluadorAsignado) {
        await this.aspiranteRepository.update(
          { id: aspiranteId, idEvaluadorAsignado: IsNull() },
          {
            idEvaluadorAsignado: user.sub,
            evaluacionAsignadaAt: new Date(),
          },
        );
        aspirante = await this.loadAspiranteWithFlow(aspiranteId);
      }

      if (aspirante.idEvaluadorAsignado !== user.sub) {
        throw new ForbiddenException(
          'Este aspirante está siendo evaluado por otro evaluador',
        );
      }

      if (aspirante.evaluationFlowStep?.orderId === 5) {
        await this.evaluationFlowService.advanceOneStepIfAt(
          aspiranteId,
          5,
          'evaluador_claim',
        );
        aspirante = await this.loadAspiranteWithFlow(aspiranteId);
      }

      return { aspirante, readOnly: false };
    }

    return { aspirante, readOnly: true };
  }

  private async isSupervisorOfAssignedEvaluador(
    userId: string,
    aspirante: Aspirante,
  ): Promise<boolean> {
    if (!aspirante.idEvaluadorAsignado) {
      return false;
    }
    const assigned = await this.usuarioRepository.findOne({
      where: { id: aspirante.idEvaluadorAsignado },
      select: ['supervisorId'],
    });
    return assigned?.supervisorId === userId;
  }

  /**
   * Firma / descarga de informe firmado:
   * - administrador: permitido (sin tenant)
   * - evaluador asignado: requiere tenant
   * - supervisor del asignado: bypass de tenant
   */
  private async assertCanAccessForFirma(
    user: JwtPayloadAdmin,
    aspirante: Aspirante,
  ): Promise<void> {
    if (user.rol === RolUsuarioAdmin.Administrador) {
      return;
    }

    if (user.rol !== RolUsuarioAdmin.Evaluador) {
      throw new ForbiddenException(
        'No tienes permiso para firmar o descargar este informe',
      );
    }

    if (aspirante.idEvaluadorAsignado === user.sub) {
      this.assertEvaluadorCanAccessAspirante(user, aspirante);
      return;
    }

    const isSupervisor = await this.isSupervisorOfAssignedEvaluador(
      user.sub,
      aspirante,
    );
    if (isSupervisor) {
      return;
    }

    throw new ForbiddenException(
      'Solo el evaluador asignado o su supervisor pueden firmar este informe',
    );
  }

  private assertCanEditEvaluation(
    user: JwtPayloadAdmin,
    aspirante: Aspirante,
  ): void {
    if (
      user.rol !== RolUsuarioAdmin.Evaluador ||
      aspirante.idEvaluadorAsignado !== user.sub
    ) {
      throw new ForbiddenException(
        'Solo el evaluador asignado puede modificar esta evaluación',
      );
    }
  }

  private async resolveEvaluadorEmail(
    idEvaluador: string | null,
  ): Promise<string | null> {
    if (!idEvaluador) {
      return null;
    }
    const usuario = await this.usuarioRepository.findOne({
      where: { id: idEvaluador },
      select: ['email'],
    });
    return usuario?.email ?? null;
  }

  private assertEvaluadorCanAccessAspirante(
    user: JwtPayloadAdmin,
    aspirante: Aspirante,
  ): void {
    if (user.rol === RolUsuarioAdmin.Evaluador) {
      if (!user.tenants?.includes(aspirante.tenantId)) {
        throw new ForbiddenException(
          'No tienes permiso para evaluar aspirantes de este hospital',
        );
      }
    }
  }

  private assertAspiranteEnColaEvaluacion(aspirante: Aspirante): void {
    const orderId = aspirante.evaluationFlowStep?.orderId;
    if (!orderId || !EVALUATION_QUEUE_ORDER_IDS.includes(orderId)) {
      throw new BadRequestException(
        'El aspirante no está disponible para evaluación (se requiere paso 5 o 6)',
      );
    }
  }

  private async loadInformePdfContext(
    aspiranteId: string,
  ): Promise<InformePdfContext> {
    const evaluacion = await this.aspiranteEvaluacionRepository.findOne({
      where: { idAspirante: aspiranteId },
    });
    if (
      !evaluacion ||
      !evaluacion.comentario?.trim() ||
      evaluacion.idVeredicto == null
    ) {
      throw new NotFoundException(
        'No existe un informe final para este aspirante',
      );
    }

    const veredicto = await this.veredictoRepository.findOne({
      where: { idVeredicto: evaluacion.idVeredicto },
    });
    if (!veredicto) {
      throw new NotFoundException('Veredicto del informe no encontrado');
    }

    const emailEvaluador = await this.resolveEvaluadorEmail(
      evaluacion.idEvaluador,
    );
    if (!emailEvaluador) {
      throw new NotFoundException('Evaluador del informe no encontrado');
    }

    return { evaluacion, veredicto, emailEvaluador };
  }

  private async loadEvaluacionAspiranteResponse(
    aspiranteId: string,
  ): Promise<AspiranteEvaluacionResponseDto | null> {
    const evaluacion = await this.aspiranteEvaluacionRepository.findOne({
      where: { idAspirante: aspiranteId },
    });
    if (!evaluacion) {
      return null;
    }

    const veredicto = await this.veredictoRepository.findOne({
      where: { idVeredicto: evaluacion.idVeredicto },
    });
    if (!veredicto) {
      return null;
    }

    return this.toEvaluacionAspiranteResponse(evaluacion, veredicto);
  }

  private toEvaluacionAspiranteResponse(
    evaluacion: AspiranteEvaluacion,
    veredicto: Veredicto,
  ): AspiranteEvaluacionResponseDto {
    return {
      comentario: evaluacion.comentario,
      veredicto: {
        idVeredicto: veredicto.idVeredicto,
        codigo: veredicto.codigo,
        etiqueta: veredicto.etiqueta,
      },
      confirmedAt: evaluacion.confirmedAt,
      createdAt: evaluacion.createdAt,
    };
  }
}
