import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { InformePdfService } from './informe-pdf.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { Aspirante } from '../aspirante/aspirante.entity';
import { PruebaAspirante } from '../pruebas/entities/prueba-aspirante.entity';
import { Prueba } from '../pruebas/entities/prueba.entity';
import { Veredicto } from './entities/veredicto.entity';
import { AspiranteEvaluacion } from './entities/aspirante-evaluacion.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { Hospital } from '../hospital/hospital.entity';
import { PruebasService } from '../pruebas/pruebas.service';
import { EvaluationFlowService } from '../aspirante/evaluation-flow.service';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import { ProcesoPrueba } from '../pruebas/entities/prueba-aspirante.entity';

describe('EvaluacionesService', () => {
  let service: EvaluacionesService;

  const aspiranteId = 'asp-uuid-1';
  const tenantId = 'tenant-uuid-1';
  const evaluadorAId = 'eval-uuid-a';
  const evaluadorBId = 'eval-uuid-b';

  const aspiranteRepo = {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const pruebaAspiranteRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const pruebaRepo = {
    find: jest.fn().mockResolvedValue([]),
  };
  const veredictoRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const aspiranteEvaluacionRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(async (dto) => ({
      ...dto,
      id: 1,
      createdAt: new Date('2025-05-31T12:00:00.000Z'),
    })),
  };
  const usuarioRepo = {
    findOne: jest.fn(),
  };
  const pruebasService = {
    buildPreguntasActivasByPrueba: jest.fn().mockResolvedValue([]),
    buildRespuestasEnriquecidas: jest.fn().mockResolvedValue({ respuestas: [] }),
    shouldUseWorkspaceResumenFormat: jest.fn().mockReturnValue(false),
    buildPreguntasResumenWorkspace: jest.fn().mockResolvedValue({
      preguntas: [],
      resumenEstadisticas: {
        totalPreguntas: 0,
        respondidas: 0,
        correctas: 0,
        incorrectas: 0,
      },
    }),
  };
  const evaluationFlowService = {
    advanceOneStepIfAt: jest.fn().mockResolvedValue({ advanced: true, newOrderId: 6 }),
    setFlowStepToOrderId: jest.fn().mockResolvedValue({ advanced: true, newOrderId: 10 }),
  };
  const informePdfService = {
    buildPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.3 mock')),
  };
  const hospitalRepo = {
    findOne: jest.fn(),
  };
  const s3Storage = {
    uploadBuffer: jest.fn().mockResolvedValue({
      key: 'informes-firmados/REG-001 - Juan García - Hospital General.pdf',
      url: 'https://bucket.s3.amazonaws.com/informes-firmados/REG-001 - Juan García - Hospital General.pdf',
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === AspiranteEvaluacion) {
            return aspiranteEvaluacionRepo;
          }
          if (entity === PruebaAspirante) {
            return pruebaAspiranteRepo;
          }
          return {};
        },
      }),
    ),
  };

  const adminUser = {
    sub: 'admin-uuid',
    type: 'admin' as const,
    rol: RolUsuarioAdmin.Administrador,
    tenants: [],
    signature: true,
    supervisorId: null as string | null,
    supervisedUserIds: [] as string[],
  };

  const evaluadorA = {
    sub: evaluadorAId,
    type: 'admin' as const,
    rol: RolUsuarioAdmin.Evaluador,
    tenants: [tenantId],
    signature: false,
    supervisorId: null as string | null,
    supervisedUserIds: [] as string[],
  };

  const evaluadorB = {
    sub: evaluadorBId,
    type: 'admin' as const,
    rol: RolUsuarioAdmin.Evaluador,
    tenants: [tenantId],
    signature: false,
    supervisorId: null as string | null,
    supervisedUserIds: [] as string[],
  };

  const supervisorId = 'eval-uuid-supervisor';
  const supervisorUser = {
    sub: supervisorId,
    type: 'admin' as const,
    rol: RolUsuarioAdmin.Evaluador,
    tenants: [] as string[],
    signature: true,
    supervisorId: null as string | null,
    supervisedUserIds: [evaluadorAId],
  };

  const aspiranteStep5 = {
    id: aspiranteId,
    tenantId,
    nombre: 'Juan',
    apellidos: 'García',
    email: 'asp@example.com',
    registroHospital: 'REG-001',
    especialidad: 'Cardiología',
    fechaNacimiento: '1995-03-15',
    idEvaluadorAsignado: null as string | null,
    evaluationFlowStep: { orderId: 5, descripcion: 'Pruebas completadas' },
  };

  const aspiranteStep6AssignedA = {
    ...aspiranteStep5,
    idEvaluadorAsignado: evaluadorAId,
    evaluationFlowStep: { orderId: 6, descripcion: 'Evaluación en curso' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    aspiranteRepo.update.mockResolvedValue({ affected: 1 });
    pruebaAspiranteRepo.find.mockResolvedValue([]);
    aspiranteEvaluacionRepo.findOne.mockResolvedValue(null);
    usuarioRepo.findOne.mockResolvedValue({ email: 'evaluador-a@hospital.com' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluacionesService,
        { provide: getRepositoryToken(Aspirante), useValue: aspiranteRepo },
        {
          provide: getRepositoryToken(PruebaAspirante),
          useValue: pruebaAspiranteRepo,
        },
        { provide: getRepositoryToken(Prueba), useValue: pruebaRepo },
        { provide: getRepositoryToken(Veredicto), useValue: veredictoRepo },
        {
          provide: getRepositoryToken(AspiranteEvaluacion),
          useValue: aspiranteEvaluacionRepo,
        },
        {
          provide: getRepositoryToken(UsuarioAdministrativo),
          useValue: usuarioRepo,
        },
        { provide: getRepositoryToken(Hospital), useValue: hospitalRepo },
        { provide: PruebasService, useValue: pruebasService },
        { provide: EvaluationFlowService, useValue: evaluationFlowService },
        { provide: DataSource, useValue: dataSource },
        { provide: InformePdfService, useValue: informePdfService },
        { provide: S3StorageService, useValue: s3Storage },
      ],
    }).compile();

    service = module.get(EvaluacionesService);
  });

  describe('asignarEvaluacion', () => {
    it('asigna al evaluador A, avanza 5→6 y no carga intentos', async () => {
      aspiranteRepo.findOne
        .mockResolvedValueOnce({ ...aspiranteStep5 })
        .mockResolvedValueOnce({
          ...aspiranteStep5,
          idEvaluadorAsignado: evaluadorAId,
        })
        .mockResolvedValueOnce({
          ...aspiranteStep6AssignedA,
        });

      const result = await service.asignarEvaluacion(aspiranteId, evaluadorA);

      expect(aspiranteRepo.update).toHaveBeenCalled();
      expect(evaluationFlowService.advanceOneStepIfAt).toHaveBeenCalledWith(
        aspiranteId,
        5,
        'evaluador_claim',
      );
      expect(pruebaAspiranteRepo.find).not.toHaveBeenCalled();
      expect(result.readOnly).toBe(false);
      expect(result.evaluationFlowOrderId).toBe(6);
      expect(result.evaluadorAsignadoEmail).toBe('evaluador-a@hospital.com');
      expect(result.message).toBe('Evaluación asignada correctamente');
    });

    it('rechaza evaluador B si A ya está asignado', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep6AssignedA,
      });
      usuarioRepo.findOne.mockResolvedValue({ supervisorId: null });

      await expect(
        service.asignarEvaluacion(aspiranteId, evaluadorB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite supervisor del asignado en modo readOnly sin tenant', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep6AssignedA,
      });
      usuarioRepo.findOne.mockImplementation(
        async (opts: { where: { id: string }; select?: string[] }) => {
          if (
            opts.where.id === evaluadorAId &&
            opts.select?.includes('supervisorId')
          ) {
            return { supervisorId };
          }
          if (opts.where.id === evaluadorAId) {
            return { email: 'evaluador-a@hospital.com' };
          }
          return null;
        },
      );

      const result = await service.asignarEvaluacion(
        aspiranteId,
        supervisorUser,
      );

      expect(result.readOnly).toBe(true);
      expect(result.message).toBe('Acceso de solo lectura');
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
      expect(evaluationFlowService.advanceOneStepIfAt).not.toHaveBeenCalled();
    });

    it('permite admin en modo readOnly sin asignar ni avanzar paso', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep6AssignedA,
      });

      const result = await service.asignarEvaluacion(aspiranteId, adminUser);

      expect(result.readOnly).toBe(true);
      expect(result.message).toBe('Acceso de solo lectura');
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
      expect(evaluationFlowService.advanceOneStepIfAt).not.toHaveBeenCalled();
    });
  });

  describe('getWorkspace', () => {
    it('asigna al evaluador A, avanza 5→6 y retorna readOnly=false', async () => {
      aspiranteRepo.findOne
        .mockResolvedValueOnce({ ...aspiranteStep5 })
        .mockResolvedValueOnce({
          ...aspiranteStep5,
          idEvaluadorAsignado: evaluadorAId,
        })
        .mockResolvedValueOnce({
          ...aspiranteStep6AssignedA,
        });

      const result = await service.getWorkspace(aspiranteId, evaluadorA);

      expect(aspiranteRepo.update).toHaveBeenCalled();
      expect(evaluationFlowService.advanceOneStepIfAt).toHaveBeenCalledWith(
        aspiranteId,
        5,
        'evaluador_claim',
      );
      expect(result.readOnly).toBe(false);
      expect(result.aspirante.evaluationFlowOrderId).toBe(6);
      expect(result.aspirante.especialidad).toBe('Cardiología');
      expect(result.aspirante.edad).toBeGreaterThanOrEqual(15);
      expect(result.evaluadorAsignadoEmail).toBe('evaluador-a@hospital.com');
    });

    it('expone edad null y especialidad null cuando faltan en el aspirante', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep6AssignedA,
        especialidad: null,
        fechaNacimiento: null,
      });

      const result = await service.getWorkspace(aspiranteId, evaluadorA);

      expect(result.aspirante.edad).toBeNull();
      expect(result.aspirante.especialidad).toBeNull();
    });

    it('rechaza evaluador B si A ya está asignado', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep6AssignedA,
      });
      usuarioRepo.findOne.mockResolvedValue({ supervisorId: null });

      await expect(
        service.getWorkspace(aspiranteId, evaluadorB),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite supervisor del asignado en modo readOnly sin tenant', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep6AssignedA,
      });
      usuarioRepo.findOne.mockImplementation(
        async (opts: { where: { id: string }; select?: string[] }) => {
          if (
            opts.where.id === evaluadorAId &&
            opts.select?.includes('supervisorId')
          ) {
            return { supervisorId };
          }
          if (opts.where.id === evaluadorAId) {
            return { email: 'evaluador-a@hospital.com' };
          }
          return null;
        },
      );

      const result = await service.getWorkspace(aspiranteId, supervisorUser);

      expect(result.readOnly).toBe(true);
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
      expect(evaluationFlowService.advanceOneStepIfAt).not.toHaveBeenCalled();
      expect(result.evaluadorAsignadoEmail).toBe('evaluador-a@hospital.com');
    });

    it('permite admin en modo readOnly sin avanzar paso', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep6AssignedA,
      });

      const result = await service.getWorkspace(aspiranteId, adminUser);

      expect(result.readOnly).toBe(true);
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
      expect(evaluationFlowService.advanceOneStepIfAt).not.toHaveBeenCalled();
    });
  });

  describe('upsertIntentoComentario', () => {
    it('retorna 410 Gone (deprecado)', async () => {
      await expect(service.upsertIntentoComentario()).rejects.toThrow(
        GoneException,
      );
    });
  });

  describe('submitInforme', () => {
    it('rechaza si el aspirante sigue en paso 5', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep6AssignedA,
        evaluationFlowStep: aspiranteStep5.evaluationFlowStep,
      });

      await expect(
        service.submitInforme(
          aspiranteId,
          { comentario: 'Informe', idVeredicto: 1 },
          evaluadorA,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza admin aunque el aspirante esté en paso 6', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep6AssignedA);

      await expect(
        service.submitInforme(
          aspiranteId,
          { comentario: 'Informe', idVeredicto: 1 },
          adminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('actualiza informe existente sin confirmar', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep6AssignedA);
      const existente = {
        id: 99,
        idAspirante: aspiranteId,
        idEvaluador: evaluadorAId,
        idVeredicto: 2,
        comentario: 'Informe anterior',
        confirmedAt: null,
      };
      aspiranteEvaluacionRepo.findOne.mockResolvedValue(existente);
      veredictoRepo.findOne.mockResolvedValue({
        idVeredicto: 1,
        codigo: 'apto',
        etiqueta: 'Apto',
        active: true,
      });

      const result = await service.submitInforme(
        aspiranteId,
        { comentario: 'Informe actualizado', idVeredicto: 1 },
        evaluadorA,
      );

      expect(result.comentario).toBe('Informe actualizado');
      expect(aspiranteEvaluacionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 99,
          comentario: 'Informe actualizado',
          idVeredicto: 1,
        }),
      );
    });

    it('rechaza actualización si la evaluación ya fue confirmada', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep6AssignedA);
      aspiranteEvaluacionRepo.findOne.mockResolvedValue({
        id: 99,
        confirmedAt: new Date('2025-06-01T12:00:00.000Z'),
      });
      veredictoRepo.findOne.mockResolvedValue({
        idVeredicto: 1,
        codigo: 'apto',
        etiqueta: 'Apto',
        active: true,
      });

      await expect(
        service.submitInforme(
          aspiranteId,
          { comentario: 'Informe', idVeredicto: 1 },
          evaluadorA,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('acepta informe sin comentarios por intento', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep6AssignedA);
      aspiranteEvaluacionRepo.findOne.mockResolvedValue(null);
      veredictoRepo.findOne.mockResolvedValue({
        idVeredicto: 1,
        codigo: 'apto',
        etiqueta: 'Apto',
        active: true,
      });

      const result = await service.submitInforme(
        aspiranteId,
        { comentario: 'Informe final', idVeredicto: 1 },
        evaluadorA,
      );

      expect(result.comentario).toBe('Informe final');
      expect(result.veredicto.codigo).toBe('apto');
      expect(aspiranteEvaluacionRepo.save).toHaveBeenCalled();
    });
  });

  describe('generateInformePdf', () => {
    const aspiranteStep7 = {
      ...aspiranteStep6AssignedA,
      evaluationFlowStep: { orderId: 7, descripcion: 'Evaluación confirmada' },
    };

    it('retorna 404 si no hay informe', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep7);
      aspiranteEvaluacionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.generateInformePdf(aspiranteId, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza evaluador de otro hospital', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep7,
        tenantId: 'otro-tenant',
      });

      await expect(
        service.generateInformePdf(aspiranteId, evaluadorA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('genera PDF cuando existe informe (incluso en paso 7)', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep7);
      aspiranteEvaluacionRepo.findOne.mockResolvedValue({
        id: 1,
        idAspirante: aspiranteId,
        idEvaluador: evaluadorAId,
        idVeredicto: 1,
        comentario: 'Informe final',
      });
      veredictoRepo.findOne.mockResolvedValue({
        idVeredicto: 1,
        codigo: 'apto',
        etiqueta: 'Apto',
      });
      usuarioRepo.findOne.mockResolvedValue({ email: 'evaluador-a@hospital.com' });

      const result = await service.generateInformePdf(aspiranteId, adminUser);

      expect(result.filename).toBe('informe-REG-001.pdf');
      expect(informePdfService.buildPdf).toHaveBeenCalledWith({
        nombre: 'Juan',
        apellidos: 'García',
        registroHospital: 'REG-001',
        emailEvaluador: 'evaluador-a@hospital.com',
        comentario: 'Informe final',
        veredictoEtiqueta: 'Apto',
        veredictoCodigo: 'apto',
        fechaInforme: expect.any(Date),
      });
      expect(result.buffer.toString()).toContain('%PDF');
    });
  });

  describe('firmarInforme', () => {
    const aspiranteStep7 = {
      ...aspiranteStep6AssignedA,
      evaluationFlowStep: { orderId: 7, descripcion: 'Evaluación confirmada' },
    };

    const evaluacion = {
      id: 1,
      idAspirante: aspiranteId,
      idEvaluador: evaluadorAId,
      idVeredicto: 1,
      comentario: 'Informe final',
    };

    beforeEach(() => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep7);
      aspiranteEvaluacionRepo.findOne.mockResolvedValue(evaluacion);
      veredictoRepo.findOne.mockResolvedValue({
        idVeredicto: 1,
        codigo: 'apto',
        etiqueta: 'Apto',
      });
      hospitalRepo.findOne.mockResolvedValue({ nombre: 'Hospital General' });
      usuarioRepo.findOne.mockImplementation(async (opts: { where: { id: string } }) => {
        if (opts.where.id === 'admin-uuid') {
          return {
            nombre: 'Admin Firmante',
            firma: 'https://example.com/firma.png',
            email: 'admin@hospital.com',
          };
        }
        if (opts.where.id === evaluadorAId) {
          return { email: 'evaluador-a@hospital.com' };
        }
        return null;
      });
    });

    it('retorna 403 si el usuario no tiene firma', async () => {
      usuarioRepo.findOne.mockResolvedValue({
        nombre: 'Sin Firma',
        firma: null,
        email: 'admin@hospital.com',
      });

      await expect(
        service.firmarInforme(aspiranteId, adminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('retorna 404 si no hay informe', async () => {
      aspiranteEvaluacionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.firmarInforme(aspiranteId, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('genera PDF firmado, sube a S3 y actualiza veredicto_informe', async () => {
      const result = await service.firmarInforme(aspiranteId, adminUser);

      expect(informePdfService.buildPdf).toHaveBeenCalledWith({
        nombre: 'Juan',
        apellidos: 'García',
        registroHospital: 'REG-001',
        emailEvaluador: 'evaluador-a@hospital.com',
        comentario: 'Informe final',
        veredictoEtiqueta: 'Apto',
        veredictoCodigo: 'apto',
        fechaInforme: expect.any(Date),
        firmaUrl: 'https://example.com/firma.png',
        nombreFirmante: 'Admin Firmante',
      });
      expect(s3Storage.uploadBuffer).toHaveBeenCalledWith({
        buffer: expect.any(Buffer),
        contentType: 'application/pdf',
        key: 'informes-firmados/REG-001 - Juan García - Hospital General.pdf',
      });
      expect(aspiranteRepo.update).toHaveBeenCalledWith(
        { id: aspiranteId },
        {
          veredictoInforme:
            'https://bucket.s3.amazonaws.com/informes-firmados/REG-001 - Juan García - Hospital General.pdf',
        },
      );
      expect(result.message).toBe('Informe firmado correctamente');
      expect(result.veredictoInforme).toContain('informes-firmados');
      expect(result.evaluationFlowOrderId).toBe(10);
      expect(evaluationFlowService.setFlowStepToOrderId).toHaveBeenCalledWith(
        aspiranteId,
        10,
        'informe_firmado',
      );
    });

    it('permite re-firmar y sobrescribir veredicto_informe', async () => {
      s3Storage.uploadBuffer.mockResolvedValueOnce({
        key: 'informes-firmados/REG-001 - Juan García - Hospital General.pdf',
        url: 'https://bucket.s3.amazonaws.com/informes-firmados/v1.pdf',
      });
      await service.firmarInforme(aspiranteId, adminUser);

      s3Storage.uploadBuffer.mockResolvedValueOnce({
        key: 'informes-firmados/REG-001 - Juan García - Hospital General.pdf',
        url: 'https://bucket.s3.amazonaws.com/informes-firmados/v2.pdf',
      });
      const result = await service.firmarInforme(aspiranteId, adminUser);

      expect(s3Storage.uploadBuffer).toHaveBeenCalledTimes(2);
      expect(result.veredictoInforme).toBe(
        'https://bucket.s3.amazonaws.com/informes-firmados/v2.pdf',
      );
    });

    it('permite al supervisor firmar sin tenant del aspirante', async () => {
      usuarioRepo.findOne.mockImplementation(
        async (opts: { where: { id: string }; select?: string[] }) => {
          if (
            opts.where.id === evaluadorAId &&
            opts.select?.includes('supervisorId')
          ) {
            return { supervisorId };
          }
          if (opts.where.id === supervisorId) {
            return {
              nombre: 'Supervisor Firmante',
              firma: 'https://example.com/firma-sup.png',
              email: 'supervisor@hospital.com',
            };
          }
          if (opts.where.id === evaluadorAId) {
            return { email: 'evaluador-a@hospital.com' };
          }
          return null;
        },
      );

      const result = await service.firmarInforme(aspiranteId, supervisorUser);

      expect(informePdfService.buildPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          firmaUrl: 'https://example.com/firma-sup.png',
          nombreFirmante: 'Supervisor Firmante',
        }),
      );
      expect(result.message).toBe('Informe firmado correctamente');
    });

    it('rechaza evaluador no asignado ni supervisor', async () => {
      usuarioRepo.findOne.mockResolvedValue({ supervisorId: null });

      await expect(
        service.firmarInforme(aspiranteId, evaluadorB),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('downloadInformeFirmado', () => {
    const aspiranteStep10 = {
      ...aspiranteStep6AssignedA,
      veredictoInforme:
        'https://bucket.s3.amazonaws.com/informes-firmados/REG-001%20-%20Juan%20Garc%C3%ADa%20-%20Hospital%20General.pdf',
      evaluationFlowStep: { orderId: 10, descripcion: 'Informe firmado' },
    };
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('retorna 404 si no hay informe firmado', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        ...aspiranteStep10,
        veredictoInforme: null,
      });

      await expect(
        service.downloadInformeFirmado(aspiranteId, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('descarga el PDF firmado con el mismo nombre usado al subir a S3', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep10);
      hospitalRepo.findOne.mockResolvedValue({ nombre: 'Hospital General' });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('%PDF-1.4 signed'),
      }) as unknown as typeof fetch;

      const result = await service.downloadInformeFirmado(aspiranteId, adminUser);

      expect(global.fetch).toHaveBeenCalledWith(aspiranteStep10.veredictoInforme);
      expect(result.buffer.toString()).toContain('%PDF');
      expect(result.filename).toBe('REG-001 - Juan García - Hospital General.pdf');
    });

    it('usa el nombre del URL si no hay hospital en catálogo', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep10);
      hospitalRepo.findOne.mockResolvedValue(null);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => Buffer.from('%PDF-1.4 signed'),
      }) as unknown as typeof fetch;

      const result = await service.downloadInformeFirmado(aspiranteId, adminUser);

      expect(result.filename).toBe('REG-001 - Juan García - Hospital General.pdf');
    });
  });

  describe('confirmarEvaluacion', () => {
    it('confirma, marca pruebas evaluada y avanza al paso 7', async () => {
      aspiranteRepo.findOne.mockResolvedValue(aspiranteStep6AssignedA);
      const evaluacion = {
        id: 1,
        idAspirante: aspiranteId,
        confirmedAt: null,
      };
      aspiranteEvaluacionRepo.findOne.mockResolvedValue(evaluacion);
      evaluationFlowService.advanceOneStepIfAt.mockResolvedValue({
        advanced: true,
        newOrderId: 7,
      });

      const result = await service.confirmarEvaluacion(aspiranteId, evaluadorA);

      expect(evaluacion.confirmedAt).toBeInstanceOf(Date);
      expect(pruebaAspiranteRepo.update).toHaveBeenCalledWith(
        { idAspirante: aspiranteId },
        { status: ProcesoPrueba.Evaluada },
      );
      expect(result.evaluationFlowOrderId).toBe(7);
    });
  });
});
