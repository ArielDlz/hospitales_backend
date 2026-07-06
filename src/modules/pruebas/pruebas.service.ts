import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Prueba } from './entities/prueba.entity';
import { CreatePruebaDto } from './dto/create-prueba.dto';
import { UpdatePruebaDto } from './dto/update-prueba.dto';
import { PruebaHospital } from './entities/prueba-hospital.entity';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { JwtPayloadAspirante } from '../../common/interfaces/jwt-payload.interface';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import { Hospital } from '../hospital/hospital.entity';
import { Aspirante } from '../aspirante/aspirante.entity';
import { Pregunta } from './entities/pregunta.entity';
import { PreguntaOpcion } from './entities/pregunta-opcion.entity';
import { PreguntaTipo } from './entities/pregunta-tipo.entity';
import { PruebaRespuesta } from './entities/prueba-respuesta.entity';
import { PruebaRespuestaOpcion } from './entities/prueba-respuesta-opcion.entity';
import { CreatePruebaHospitalDto } from './dto/create-prueba-hospital.dto';
import { UpdatePruebaHospitalDto } from './dto/update-prueba-hospital.dto';
import { CreatePruebaAspiranteDto } from './dto/create-prueba-aspirante.dto';
import { ProcesoPrueba, PruebaAspirante } from './entities/prueba-aspirante.entity';
import { PreguntaPruebaResponseDto } from './dto/pregunta-prueba-response.dto';
import { PruebaAspiranteEstadoResponseDto } from './dto/prueba-aspirante-estado-response.dto';
import { CreatePruebaRespuestaDto } from './dto/create-prueba-respuesta.dto';
import { UpdatePruebaRespuestaDto } from './dto/update-prueba-respuesta.dto';
import { RespuestaStatusDto } from './dto/respuesta-status.dto';
import { UpdatePruebaAspiranteActionDto } from './dto/update-prueba-aspirante-action.dto';
import {
  PruebaRespuestaGuardadaDto,
  PruebaRespuestasIntentoResponseDto,
} from './dto/prueba-respuesta-guardada.dto';
import {
  PruebaRespuestaDisplayDto,
  PruebaRespuestasEnriquecidasDto,
} from './dto/prueba-respuesta-display.dto';
import {
  IntentoResumenEstadisticasDto,
  PreguntaResumenWorkspaceDto,
} from './dto/pregunta-resumen-workspace.dto';
import { EvaluationFlowService } from '../aspirante/evaluation-flow.service';

/** Pruebas que en el workspace del evaluador usan formato resumen (sin listar todas las opciones). */
const PRUEBAS_WORKSPACE_RESUMEN_IDS = new Set([3]);
const TIPO_PREGUNTA_RESUMEN = 'mostrar_imagen_multi';

@Injectable()
export class PruebasService {
  constructor(
    @InjectRepository(Prueba)
    private readonly pruebaRepository: Repository<Prueba>,
    @InjectRepository(PruebaHospital)
    private readonly pruebaHospitalRepository: Repository<PruebaHospital>,
    @InjectRepository(PruebaAspirante)
    private readonly pruebaAspiranteRepository: Repository<PruebaAspirante>,
    @InjectRepository(Pregunta)
    private readonly preguntaRepository: Repository<Pregunta>,
    @InjectRepository(PreguntaOpcion)
    private readonly preguntaOpcionRepository: Repository<PreguntaOpcion>,
    @InjectRepository(PreguntaTipo)
    private readonly preguntaTipoRepository: Repository<PreguntaTipo>,
    @InjectRepository(PruebaRespuesta)
    private readonly pruebaRespuestaRepository: Repository<PruebaRespuesta>,
    @InjectRepository(PruebaRespuestaOpcion)
    private readonly pruebaRespuestaOpcionRepository: Repository<PruebaRespuestaOpcion>,
    @InjectRepository(Hospital)
    private readonly hospitalRepository: Repository<Hospital>,
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    private readonly evaluationFlowService: EvaluationFlowService,
  ) {}

  private assertAdministrador(user: JwtPayloadAdmin): void {
    if (user.rol !== RolUsuarioAdmin.Administrador) {
      throw new ForbiddenException('Solo los administradores pueden gestionar el catálogo de pruebas');
    }
  }

  async findAll(includeInactive = false): Promise<Prueba[]> {
    const where = includeInactive ? {} : { active: true };
    return this.pruebaRepository.find({
      where,
      order: { idPrueba: 'ASC' },
    });
  }

  async findOne(idPrueba: number, includeInactive = false): Promise<Prueba | null> {
    const where: { idPrueba: number; active?: boolean } = { idPrueba };
    if (!includeInactive) {
      where.active = true;
    }
    return this.pruebaRepository.findOne({ where });
  }

  async create(dto: CreatePruebaDto, user: JwtPayloadAdmin): Promise<Prueba> {
    this.assertAdministrador(user);
    const entity = this.pruebaRepository.create({
      nombre: dto.nombre.trim(),
      instrucciones:
        dto.instrucciones === undefined || dto.instrucciones === null
          ? null
          : dto.instrucciones.trim() || null,
      active: true,
    });
    return this.pruebaRepository.save(entity);
  }

  async update(
    idPrueba: number,
    dto: UpdatePruebaDto,
    user: JwtPayloadAdmin,
  ): Promise<Prueba> {
    this.assertAdministrador(user);
    const prueba = await this.pruebaRepository.findOne({
      where: { idPrueba },
    });
    if (!prueba) {
      throw new NotFoundException(`Prueba con id ${idPrueba} no encontrada`);
    }
    if (dto.nombre !== undefined) {
      prueba.nombre = dto.nombre.trim();
    }
    if (dto.instrucciones !== undefined) {
      prueba.instrucciones =
        dto.instrucciones === null ? null : dto.instrucciones.trim() || null;
    }
    if (dto.active !== undefined) {
      prueba.active = dto.active;
    }
    return this.pruebaRepository.save(prueba);
  }

  async softDelete(idPrueba: number, user: JwtPayloadAdmin): Promise<Prueba> {
    this.assertAdministrador(user);
    const prueba = await this.pruebaRepository.findOne({
      where: { idPrueba },
    });
    if (!prueba) {
      throw new NotFoundException(`Prueba con id ${idPrueba} no encontrada`);
    }
    prueba.active = false;
    return this.pruebaRepository.save(prueba);
  }

  async findAllPruebasHospitales(): Promise<PruebaHospital[]> {
    return this.pruebaHospitalRepository.find({
      order: { idPruebaHospital: 'ASC' },
    });
  }

  async findAvailablePruebasByTenantSlug(slug: string): Promise<Prueba[]> {
    const tenant = await this.hospitalRepository.findOne({
      where: { slug: slug.trim().toLowerCase() },
      select: ['uuid'],
    });
    if (!tenant) {
      throw new NotFoundException(
        `No existe un hospital con slug ${slug}`,
      );
    }

    const asignaciones = await this.pruebaHospitalRepository.find({
      where: { tenantId: tenant.uuid, show: true },
      select: ['idPrueba'],
    });

    if (asignaciones.length === 0) {
      return [];
    }

    const idsPrueba = asignaciones.map((a) => a.idPrueba);
    return this.pruebaRepository.find({
      where: { idPrueba: In(idsPrueba), active: true },
      order: { idPrueba: 'ASC' },
    });
  }

  async createPruebaHospital(
    dto: CreatePruebaHospitalDto,
    user: JwtPayloadAdmin,
  ): Promise<PruebaHospital> {
    this.assertAdministrador(user);

    const prueba = await this.pruebaRepository.findOne({
      where: { idPrueba: dto.id_prueba },
    });
    if (!prueba) {
      throw new BadRequestException(
        `No existe una prueba con id ${dto.id_prueba}`,
      );
    }

    const tenant = await this.hospitalRepository.findOne({
      where: { uuid: dto.tenant_id },
      select: ['uuid'],
    });
    if (!tenant) {
      throw new BadRequestException(
        `No existe un hospital con tenant_id ${dto.tenant_id}`,
      );
    }

    const existing = await this.pruebaHospitalRepository.findOne({
      where: { idPrueba: dto.id_prueba, tenantId: dto.tenant_id },
    });
    if (existing) {
      throw new ConflictException(
        'La asignación prueba-hospital ya existe',
      );
    }

    const entity = this.pruebaHospitalRepository.create({
      idPrueba: dto.id_prueba,
      tenantId: dto.tenant_id,
      show: true,
    });
    return this.pruebaHospitalRepository.save(entity);
  }

  async updatePruebaHospital(
    idPruebaHospital: number,
    dto: UpdatePruebaHospitalDto,
    user: JwtPayloadAdmin,
  ): Promise<PruebaHospital> {
    this.assertAdministrador(user);

    const row = await this.pruebaHospitalRepository.findOne({
      where: { idPruebaHospital },
    });
    if (!row) {
      throw new NotFoundException(
        `Asignación con id ${idPruebaHospital} no encontrada`,
      );
    }

    row.show = dto.show;
    return this.pruebaHospitalRepository.save(row);
  }

  async createPruebaAspirante(
    dto: CreatePruebaAspiranteDto,
    user: JwtPayloadAspirante,
  ): Promise<PruebaAspirante> {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: user.sub },
      select: ['id', 'tenantId', 'active'],
    });
    if (!aspirante || !aspirante.active) {
      throw new BadRequestException('Aspirante inválido o inactivo');
    }

    const prueba = await this.pruebaRepository.findOne({
      where: { idPrueba: dto.id_prueba, active: true },
      select: ['idPrueba'],
    });
    if (!prueba) {
      throw new BadRequestException('La prueba no existe o está inactiva');
    }

    const habilitada = await this.pruebaHospitalRepository.findOne({
      where: {
        idPrueba: dto.id_prueba,
        tenantId: aspirante.tenantId,
        show: true,
      },
      select: ['idPruebaHospital'],
    });
    if (!habilitada) {
      throw new BadRequestException(
        'La prueba no está habilitada para el tenant del aspirante',
      );
    }

    const entity = this.pruebaAspiranteRepository.create({
      idPrueba: dto.id_prueba,
      idAspirante: aspirante.id,
      inicioAt: new Date(),
      status: ProcesoPrueba.Iniciada,
      finAt: null,
    });

    try {
      return await this.pruebaAspiranteRepository.save(entity);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as { driverError?: { code?: string } }).driverError?.code ===
          '23505'
      ) {
        throw new ConflictException(
          'El aspirante ya tiene un intento registrado para esta prueba',
        );
      }
      throw error;
    }
  }

  async buildPreguntasActivasByPrueba(
    idPrueba: number,
  ): Promise<PreguntaPruebaResponseDto[]> {
    const preguntas = await this.preguntaRepository.find({
      where: { idPrueba, active: true },
      order: { orden: 'ASC', idPregunta: 'ASC' },
    });
    if (preguntas.length === 0) {
      return [];
    }

    const idsPregunta = preguntas.map((p) => p.idPregunta);
    const idsTipo = [...new Set(preguntas.map((p) => p.idTipo))];
    const opciones = await this.preguntaOpcionRepository.find({
      where: { idPregunta: In(idsPregunta), active: true },
      order: { idPreguntaOpcion: 'ASC' },
      select: ['idPreguntaOpcion', 'idPregunta', 'opcion'],
    });
    const tipos = await this.preguntaTipoRepository.find({
      where: { idPreguntaTipo: In(idsTipo) },
      select: ['idPreguntaTipo', 'descripcion'],
    });

    const opcionesByPregunta = new Map<
      number,
      { idPreguntaOpcion: number; opcion: string }[]
    >();
    const descripcionTipoById = new Map<number, string>();
    for (const tipo of tipos) {
      descripcionTipoById.set(tipo.idPreguntaTipo, tipo.descripcion);
    }
    for (const opcion of opciones) {
      const current = opcionesByPregunta.get(opcion.idPregunta) ?? [];
      current.push({
        idPreguntaOpcion: opcion.idPreguntaOpcion,
        opcion: opcion.opcion,
      });
      opcionesByPregunta.set(opcion.idPregunta, current);
    }

    return preguntas.map((pregunta) => ({
      idPregunta: pregunta.idPregunta,
      idPrueba: pregunta.idPrueba,
      texto: pregunta.texto,
      tipo: descripcionTipoById.get(pregunta.idTipo) ?? `tipo_${pregunta.idTipo}`,
      orden: pregunta.orden,
      opciones: opcionesByPregunta.get(pregunta.idPregunta) ?? [],
    }));
  }

  async getPreguntasActivasByPruebaForAspirante(
    idPrueba: number,
    user: JwtPayloadAspirante,
  ): Promise<PreguntaPruebaResponseDto[]> {
    const intento = await this.pruebaAspiranteRepository.findOne({
      where: {
        idPrueba,
        idAspirante: user.sub,
      },
      select: ['idPruebaAspirante'],
    });
    if (!intento) {
      throw new BadRequestException(
        'Debes iniciar esta prueba antes de consultar sus preguntas',
      );
    }

    return this.buildPreguntasActivasByPrueba(idPrueba);
  }

  async getEstadoPruebasIniciadasAspirante(
    user: JwtPayloadAspirante,
  ): Promise<PruebaAspiranteEstadoResponseDto[]> {
    const registros = await this.pruebaAspiranteRepository.find({
      where: { idAspirante: user.sub },
      order: { inicioAt: 'DESC', idPruebaAspirante: 'DESC' },
    });

    if (registros.length === 0) {
      return [];
    }

    const idsPrueba = [...new Set(registros.map((r) => r.idPrueba))];
    const pruebas = await this.pruebaRepository.find({
      where: { idPrueba: In(idsPrueba) },
      select: ['idPrueba', 'nombre'],
    });
    const pruebaNombreById = new Map<number, string>();
    for (const prueba of pruebas) {
      pruebaNombreById.set(prueba.idPrueba, prueba.nombre);
    }

    return registros.map((registro) => ({
      pruebaActual: {
        idPruebaAspirante: registro.idPruebaAspirante,
        nombre:
          pruebaNombreById.get(registro.idPrueba) ?? `Prueba ${registro.idPrueba}`,
      },
      status: registro.status,
    }));
  }

  async updatePruebaAspiranteByAction(
    idPruebaAspirante: number,
    dto: UpdatePruebaAspiranteActionDto,
    user: JwtPayloadAspirante,
  ): Promise<{ message: string }> {
    const registro = await this.pruebaAspiranteRepository.findOne({
      where: {
        idPruebaAspirante,
        idAspirante: user.sub,
      },
    });
    if (!registro) {
      throw new NotFoundException(
        `No existe prueba_aspirante con id ${idPruebaAspirante} para este aspirante`,
      );
    }

    const action = dto.action.trim().toLowerCase();
    if (action !== 'finalizada por el aspirante') {
      throw new BadRequestException(
        'Acción no soportada. Usa: "finalizada por el aspirante"',
      );
    }

    if (registro.status !== ProcesoPrueba.Iniciada) {
      throw new BadRequestException(
        `No se puede finalizar la prueba porque su estado actual es "${registro.status}" (se requiere "iniciada")`,
      );
    }

    registro.status = ProcesoPrueba.PorEvaluar;
    registro.finAt = new Date();
    await this.pruebaAspiranteRepository.save(registro);

    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: user.sub },
      select: ['tenantId'],
    });
    if (aspirante) {
      await this.evaluationFlowService.tryAdvanceFromStep4(
        user.sub,
        aspirante.tenantId,
      );
    }

    return {
      message: 'prueba actualizada correctamente',
    };
  }

  private normalizeTipo(tipo: string | undefined | null): string {
    return (tipo ?? '').trim().toLowerCase();
  }

  private async resolveTipoDescripcionByPregunta(
    idPregunta: number,
  ): Promise<string> {
    const pregunta = await this.preguntaRepository.findOne({
      where: { idPregunta },
      select: ['idTipo'],
    });
    if (!pregunta) {
      throw new NotFoundException(`Pregunta con id ${idPregunta} no encontrada`);
    }
    const tipo = await this.preguntaTipoRepository.findOne({
      where: { idPreguntaTipo: pregunta.idTipo },
      select: ['descripcion'],
    });
    if (!tipo) {
      throw new BadRequestException(
        `No existe tipo de pregunta configurado para id_tipo ${pregunta.idTipo}`,
      );
    }
    return this.normalizeTipo(tipo.descripcion);
  }

  private mapValorRespuestaGuardada(
    row: PruebaRespuesta,
    tipo: string,
    opcionesMultiples: number[],
  ): string | number | number[] | null {
    if (tipo === 'texto_libre') {
      return row.respuestaTexto;
    }
    if (tipo === 'archivo' || tipo === 'cargar_archivo') {
      return row.urlRespuesta;
    }
    if (tipo === 'opcion_unica' || tipo === 'mostrar_imagen_multi') {
      return row.idPreguntaOpcion;
    }
    if (tipo === 'opcion_multiple') {
      if (opcionesMultiples.length > 0) {
        return opcionesMultiples;
      }
      if (row.respuestaTexto) {
        try {
          const parsed = JSON.parse(row.respuestaTexto) as unknown;
          if (Array.isArray(parsed)) {
            return parsed.map((v) => Number(v)).filter((n) => Number.isInteger(n));
          }
        } catch {
          return [];
        }
      }
      return [];
    }
    return row.respuestaTexto ?? row.urlRespuesta ?? row.idPreguntaOpcion;
  }

  private isTipoConOpciones(tipo: string): boolean {
    return (
      tipo === 'opcion_unica' ||
      tipo === 'opcion_multiple' ||
      tipo === 'mostrar_imagen_multi'
    );
  }

  private isTipoOpcionUnica(tipo: string): boolean {
    return tipo === 'opcion_unica' || tipo === 'mostrar_imagen_multi';
  }

  shouldUseWorkspaceResumenFormat(
    idPrueba: number,
    preguntas: Pick<PreguntaPruebaResponseDto, 'tipo'>[],
  ): boolean {
    if (PRUEBAS_WORKSPACE_RESUMEN_IDS.has(idPrueba)) {
      return true;
    }
    return (
      preguntas.length > 0 &&
      preguntas.every((p) => p.tipo === TIPO_PREGUNTA_RESUMEN)
    );
  }

  async buildPreguntasResumenWorkspace(
    idPruebaAspirante: number,
    idPrueba: number,
  ): Promise<{
    preguntas: PreguntaResumenWorkspaceDto[];
    resumenEstadisticas: IntentoResumenEstadisticasDto;
  }> {
    const preguntasDb = await this.preguntaRepository.find({
      where: { idPrueba, active: true },
      order: { orden: 'ASC', idPregunta: 'ASC' },
    });

    const idsTipo = [...new Set(preguntasDb.map((p) => p.idTipo))];
    const tipos = idsTipo.length
      ? await this.preguntaTipoRepository.find({
          where: { idPreguntaTipo: In(idsTipo) },
          select: ['idPreguntaTipo', 'descripcion'],
        })
      : [];
    const descripcionTipoById = new Map<number, string>();
    for (const t of tipos) {
      descripcionTipoById.set(t.idPreguntaTipo, this.normalizeTipo(t.descripcion));
    }

    const enriched = await this.buildRespuestasEnriquecidas(idPruebaAspirante);
    const respuestaByPregunta = new Map(
      (enriched?.respuestas ?? []).map((r) => [r.idPregunta, r]),
    );

    const selectedOpcionIds = new Set<number>();
    for (const row of enriched?.respuestas ?? []) {
      if (typeof row.respuesta === 'number') {
        selectedOpcionIds.add(row.respuesta);
      }
    }

    const opcionById = new Map<
      number,
      { idPreguntaOpcion: number; opcion: string; correcta: boolean }
    >();
    if (selectedOpcionIds.size > 0) {
      const opciones = await this.preguntaOpcionRepository.find({
        where: { idPreguntaOpcion: In([...selectedOpcionIds]) },
        select: ['idPreguntaOpcion', 'opcion', 'correcta'],
      });
      for (const op of opciones) {
        opcionById.set(op.idPreguntaOpcion, {
          idPreguntaOpcion: op.idPreguntaOpcion,
          opcion: op.opcion,
          correcta: op.correcta,
        });
      }
    }

    let respondidas = 0;
    let correctas = 0;
    let incorrectas = 0;

    const preguntas: PreguntaResumenWorkspaceDto[] = preguntasDb.map((pregunta) => {
      const tipo =
        descripcionTipoById.get(pregunta.idTipo) ?? `tipo_${pregunta.idTipo}`;
      const respuestaRow = respuestaByPregunta.get(pregunta.idPregunta);
      let respuesta: PreguntaResumenWorkspaceDto['respuesta'] = null;

      if (respuestaRow && typeof respuestaRow.respuesta === 'number') {
        const opcion = opcionById.get(respuestaRow.respuesta);
        if (opcion) {
          respuesta = opcion;
          respondidas += 1;
          if (opcion.correcta) {
            correctas += 1;
          } else {
            incorrectas += 1;
          }
        }
      }

      return {
        idPregunta: pregunta.idPregunta,
        idPrueba: pregunta.idPrueba,
        texto: pregunta.texto,
        tipo,
        orden: pregunta.orden,
        respuesta,
      };
    });

    return {
      preguntas,
      resumenEstadisticas: {
        totalPreguntas: preguntas.length,
        respondidas,
        correctas,
        incorrectas,
      },
    };
  }

  private async buildCorrectOpcionIdsByPregunta(
    idsPregunta: number[],
  ): Promise<Map<number, Set<number>>> {
    if (idsPregunta.length === 0) {
      return new Map();
    }
    const opciones = await this.preguntaOpcionRepository.find({
      where: { idPregunta: In(idsPregunta), active: true, correcta: true },
      select: ['idPregunta', 'idPreguntaOpcion'],
    });
    const correctIdsByPregunta = new Map<number, Set<number>>();
    for (const op of opciones) {
      const current = correctIdsByPregunta.get(op.idPregunta) ?? new Set<number>();
      current.add(op.idPreguntaOpcion);
      correctIdsByPregunta.set(op.idPregunta, current);
    }
    return correctIdsByPregunta;
  }

  private evaluateEsCorrecta(
    tipo: string,
    raw: string | number | number[] | null,
    correctIdsByPregunta: Map<number, Set<number>>,
    idPregunta: number,
  ): boolean | null {
    if (!this.isTipoConOpciones(tipo)) {
      return null;
    }

    const correctIds = correctIdsByPregunta.get(idPregunta);
    if (!correctIds || correctIds.size === 0) {
      return null;
    }

    if (this.isTipoOpcionUnica(tipo)) {
      if (typeof raw !== 'number') {
        return false;
      }
      return correctIds.has(raw);
    }

    if (!Array.isArray(raw)) {
      return false;
    }
    const selected = new Set(raw);
    if (selected.size !== correctIds.size) {
      return false;
    }
    for (const id of correctIds) {
      if (!selected.has(id)) {
        return false;
      }
    }
    return true;
  }

  private mapRespuestaParaDisplay(
    raw: string | number | number[] | null,
    tipo: string,
    labelByOpcionId: Map<number, string>,
  ): string | number | number[] | string[] | null {
    if (this.isTipoOpcionUnica(tipo)) {
      if (typeof raw === 'number') {
        return labelByOpcionId.get(raw) ?? String(raw);
      }
      return raw;
    }
    if (tipo === 'opcion_multiple') {
      if (Array.isArray(raw)) {
        return raw.map((id) => labelByOpcionId.get(id) ?? String(id));
      }
      return raw;
    }
    return raw;
  }

  async buildRespuestasEnriquecidas(
    idPruebaAspirante: number,
    options?: { resolveOptionLabels?: boolean; evaluateCorrectness?: boolean },
  ): Promise<PruebaRespuestasEnriquecidasDto | null> {
    const intento = await this.pruebaAspiranteRepository.findOne({
      where: { idPruebaAspirante },
      select: ['idPruebaAspirante', 'idPrueba'],
    });
    if (!intento) {
      return null;
    }

    const filas = await this.pruebaRespuestaRepository.find({
      where: { idPruebaAspirante },
      order: { idPregunta: 'ASC', idPruebaRespuesta: 'ASC' },
    });
    if (filas.length === 0) {
      return {
        idPruebaAspirante: intento.idPruebaAspirante,
        idPrueba: intento.idPrueba,
        respuestas: [],
      };
    }

    const idsPregunta = [...new Set(filas.map((f) => f.idPregunta))];
    const preguntas = await this.preguntaRepository.find({
      where: { idPregunta: In(idsPregunta) },
      select: ['idPregunta', 'idTipo'],
    });
    const idsTipo = [...new Set(preguntas.map((p) => p.idTipo))];
    const tipos = await this.preguntaTipoRepository.find({
      where: { idPreguntaTipo: In(idsTipo) },
      select: ['idPreguntaTipo', 'descripcion'],
    });
    const tipoByPregunta = new Map<number, string>();
    const descripcionByTipoId = new Map<number, string>();
    for (const t of tipos) {
      descripcionByTipoId.set(t.idPreguntaTipo, this.normalizeTipo(t.descripcion));
    }
    for (const p of preguntas) {
      tipoByPregunta.set(
        p.idPregunta,
        descripcionByTipoId.get(p.idTipo) ?? `tipo_${p.idTipo}`,
      );
    }

    const idsPruebaRespuesta = filas.map((f) => f.idPruebaRespuesta);
    const opcionesRows = await this.pruebaRespuestaOpcionRepository.find({
      where: { idPruebaRespuesta: In(idsPruebaRespuesta) },
      order: { idPreguntaOpcion: 'ASC' },
      select: ['idPruebaRespuesta', 'idPreguntaOpcion'],
    });
    const opcionesByRespuesta = new Map<number, number[]>();
    for (const o of opcionesRows) {
      const current = opcionesByRespuesta.get(o.idPruebaRespuesta) ?? [];
      current.push(o.idPreguntaOpcion);
      opcionesByRespuesta.set(o.idPruebaRespuesta, current);
    }

    const labelByOpcionId = new Map<number, string>();
    const opcionIds = new Set<number>();
    for (const row of filas) {
      if (row.idPreguntaOpcion) {
        opcionIds.add(row.idPreguntaOpcion);
      }
      for (const id of opcionesByRespuesta.get(row.idPruebaRespuesta) ?? []) {
        opcionIds.add(id);
      }
    }
    if (options?.resolveOptionLabels && opcionIds.size > 0) {
      const opciones = await this.preguntaOpcionRepository.find({
        where: { idPreguntaOpcion: In([...opcionIds]) },
        select: ['idPreguntaOpcion', 'opcion'],
      });
      for (const op of opciones) {
        labelByOpcionId.set(op.idPreguntaOpcion, op.opcion);
      }
    }

    const correctIdsByPregunta = options?.evaluateCorrectness
      ? await this.buildCorrectOpcionIdsByPregunta(idsPregunta)
      : new Map<number, Set<number>>();

    const respuestas: PruebaRespuestaDisplayDto[] = filas.map((row) => {
      const tipo = tipoByPregunta.get(row.idPregunta) ?? 'texto_libre';
      const opcionesMultiples =
        opcionesByRespuesta.get(row.idPruebaRespuesta) ?? [];
      const raw = this.mapValorRespuestaGuardada(row, tipo, opcionesMultiples);
      const respuesta = options?.resolveOptionLabels
        ? this.mapRespuestaParaDisplay(raw, tipo, labelByOpcionId)
        : raw;

      const item: PruebaRespuestaDisplayDto = {
        idPruebaRespuesta: row.idPruebaRespuesta,
        idPregunta: row.idPregunta,
        tipo,
        respuesta,
      };

      if (options?.evaluateCorrectness && this.isTipoConOpciones(tipo)) {
        item.esCorrecta = this.evaluateEsCorrecta(
          tipo,
          raw,
          correctIdsByPregunta,
          row.idPregunta,
        );
      }

      return item;
    });

    return {
      idPruebaAspirante: intento.idPruebaAspirante,
      idPrueba: intento.idPrueba,
      respuestas,
    };
  }

  async getPruebaRespuestasByIntento(
    idPruebaAspirante: number,
    user: JwtPayloadAspirante,
  ): Promise<PruebaRespuestasIntentoResponseDto> {
    const intento = await this.pruebaAspiranteRepository.findOne({
      where: {
        idPruebaAspirante,
        idAspirante: user.sub,
      },
      select: ['idPruebaAspirante'],
    });
    if (!intento) {
      throw new BadRequestException(
        'No existe el intento de prueba para este aspirante',
      );
    }

    const enriched = await this.buildRespuestasEnriquecidas(idPruebaAspirante);
    const respuestas: PruebaRespuestaGuardadaDto[] = (enriched?.respuestas ?? []).map(
      (r) => ({
        idPruebaRespuesta: r.idPruebaRespuesta,
        idPregunta: r.idPregunta,
        tipo: r.tipo,
        respuesta: r.respuesta as string | number | number[] | null,
      }),
    );

    return {
      idPruebaAspirante: enriched!.idPruebaAspirante,
      idPrueba: enriched!.idPrueba,
      respuestas,
    };
  }

  private async parseRespuestaSegunTipo(params: {
    idPregunta: number;
    tipo: string;
    respuesta: unknown;
    idPruebaRespuestaExistente?: number;
  }): Promise<{
    respuestaTexto: string | null;
    idPreguntaOpcion: number | null;
    urlRespuesta: string | null;
    opcionesMultiples: number[];
  }> {
    const tipo = this.normalizeTipo(params.tipo);

    if (tipo === 'texto_libre') {
      if (typeof params.respuesta !== 'string' || !params.respuesta.trim()) {
        throw new BadRequestException(
          'Para tipo texto_libre, respuesta debe ser texto no vacío',
        );
      }
      return {
        respuestaTexto: params.respuesta.trim(),
        idPreguntaOpcion: null,
        urlRespuesta: null,
        opcionesMultiples: [],
      };
    }

    if (tipo === 'archivo' || tipo === 'cargar_archivo') {
      if (typeof params.respuesta !== 'string' || !params.respuesta.trim()) {
        throw new BadRequestException(
          'Para tipo archivo/cargar_archivo, respuesta debe ser una URL no vacía',
        );
      }
      return {
        respuestaTexto: null,
        idPreguntaOpcion: null,
        urlRespuesta: params.respuesta.trim(),
        opcionesMultiples: [],
      };
    }

    if (tipo === 'opcion_unica' || tipo === 'mostrar_imagen_multi') {
      const opcionId =
        typeof params.respuesta === 'number'
          ? params.respuesta
          : Number(params.respuesta);
      if (!Number.isInteger(opcionId) || opcionId < 1) {
        throw new BadRequestException(
          `Para tipo ${tipo}, respuesta debe ser id numérico de opción`,
        );
      }
      const opcion = await this.preguntaOpcionRepository.findOne({
        where: {
          idPreguntaOpcion: opcionId,
          idPregunta: params.idPregunta,
          active: true,
        },
        select: ['idPreguntaOpcion'],
      });
      if (!opcion) {
        throw new BadRequestException(
          `La opción ${opcionId} no existe o no pertenece a la pregunta ${params.idPregunta}`,
        );
      }
      return {
        respuestaTexto: null,
        idPreguntaOpcion: opcion.idPreguntaOpcion,
        urlRespuesta: null,
        opcionesMultiples: [],
      };
    }

    if (tipo === 'opcion_multiple') {
      if (!Array.isArray(params.respuesta) || params.respuesta.length === 0) {
        throw new BadRequestException(
          'Para tipo opcion_multiple, respuesta debe ser un arreglo de IDs de opciones',
        );
      }
      const opcionesIds = params.respuesta.map((v) => Number(v));
      const opcionesInvalidas = opcionesIds.some(
        (id) => !Number.isInteger(id) || id < 1,
      );
      if (opcionesInvalidas) {
        throw new BadRequestException(
          'El arreglo de opcion_multiple contiene IDs inválidos',
        );
      }
      const opciones = await this.preguntaOpcionRepository.find({
        where: {
          idPreguntaOpcion: In(opcionesIds),
          idPregunta: params.idPregunta,
          active: true,
        },
        select: ['idPreguntaOpcion'],
      });
      if (opciones.length !== new Set(opcionesIds).size) {
        throw new BadRequestException(
          'Una o más opciones no existen, están inactivas o no pertenecen a la pregunta',
        );
      }
      return {
        // Se guarda JSON para cumplir constraint de "al menos un valor".
        respuestaTexto: JSON.stringify(opcionesIds),
        idPreguntaOpcion: null,
        urlRespuesta: null,
        opcionesMultiples: [...new Set(opcionesIds)],
      };
    }

    throw new BadRequestException(
      `Tipo de pregunta no soportado: ${params.tipo}`,
    );
  }

  async createPruebaRespuesta(
    dto: CreatePruebaRespuestaDto,
    user: JwtPayloadAspirante,
  ): Promise<RespuestaStatusDto> {
    const intento = await this.pruebaAspiranteRepository.findOne({
      where: {
        idPruebaAspirante: dto.id_prueba_aspirante,
        idAspirante: user.sub,
      },
      select: ['idPruebaAspirante', 'idPrueba'],
    });
    if (!intento) {
      throw new BadRequestException(
        'No existe el intento de prueba para este aspirante',
      );
    }

    const pregunta = await this.preguntaRepository.findOne({
      where: {
        idPregunta: dto.id_pregunta,
        idPrueba: intento.idPrueba,
        active: true,
      },
      select: ['idPregunta'],
    });
    if (!pregunta) {
      throw new BadRequestException(
        'La pregunta no existe, no está activa o no pertenece a la prueba iniciada',
      );
    }

    const parsed = await this.parseRespuestaSegunTipo({
      idPregunta: dto.id_pregunta,
      tipo: dto.tipo,
      respuesta: dto.respuesta,
    });

    const entity = this.pruebaRespuestaRepository.create({
      idPruebaAspirante: dto.id_prueba_aspirante,
      idPregunta: dto.id_pregunta,
      respuestaTexto: parsed.respuestaTexto,
      idPreguntaOpcion: parsed.idPreguntaOpcion,
      urlRespuesta: parsed.urlRespuesta,
    });

    let saved: PruebaRespuesta;
    try {
      saved = await this.pruebaRespuestaRepository.save(entity);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as { driverError?: { code?: string } }).driverError?.code ===
          '23505'
      ) {
        throw new ConflictException(
          'Ya existe una respuesta para esta pregunta en este intento',
        );
      }
      throw error;
    }

    if (parsed.opcionesMultiples.length > 0) {
      const rows = parsed.opcionesMultiples.map((idPreguntaOpcion) =>
        this.pruebaRespuestaOpcionRepository.create({
          idPruebaRespuesta: saved.idPruebaRespuesta,
          idPreguntaOpcion,
        }),
      );
      await this.pruebaRespuestaOpcionRepository.save(rows);
    }

    await this.evaluationFlowService.tryAdvanceFromStep3(
      user.sub,
      dto.id_prueba_aspirante,
    );

    return {
      message: 'respuesta guardada correctamente',
      id_prueba_respuesta: saved.idPruebaRespuesta,
    };
  }

  async updatePruebaRespuesta(
    idPruebaRespuesta: number,
    dto: UpdatePruebaRespuestaDto,
    user: JwtPayloadAspirante,
  ): Promise<RespuestaStatusDto> {
    const existente = await this.pruebaRespuestaRepository.findOne({
      where: { idPruebaRespuesta },
    });
    if (!existente) {
      throw new NotFoundException(
        `No existe respuesta con id ${idPruebaRespuesta}`,
      );
    }

    const intento = await this.pruebaAspiranteRepository.findOne({
      where: {
        idPruebaAspirante: existente.idPruebaAspirante,
        idAspirante: user.sub,
      },
      select: ['idPruebaAspirante'],
    });
    if (!intento) {
      throw new BadRequestException(
        'No tienes permisos para actualizar esta respuesta',
      );
    }

    const tipo =
      dto.tipo?.trim() || (await this.resolveTipoDescripcionByPregunta(existente.idPregunta));
    const parsed = await this.parseRespuestaSegunTipo({
      idPregunta: existente.idPregunta,
      tipo,
      respuesta: dto.respuesta,
      idPruebaRespuestaExistente: idPruebaRespuesta,
    });

    existente.respuestaTexto = parsed.respuestaTexto;
    existente.idPreguntaOpcion = parsed.idPreguntaOpcion;
    existente.urlRespuesta = parsed.urlRespuesta;
    await this.pruebaRespuestaRepository.save(existente);

    await this.pruebaRespuestaOpcionRepository.delete({
      idPruebaRespuesta,
    });
    if (parsed.opcionesMultiples.length > 0) {
      const rows = parsed.opcionesMultiples.map((idPreguntaOpcion) =>
        this.pruebaRespuestaOpcionRepository.create({
          idPruebaRespuesta,
          idPreguntaOpcion,
        }),
      );
      await this.pruebaRespuestaOpcionRepository.save(rows);
    }

    return {
      message: 'respuesta actualizada correctamente',
      id_prueba_respuesta: idPruebaRespuesta,
    };
  }
}
