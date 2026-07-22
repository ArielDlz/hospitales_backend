import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EvaluationFlowService } from './evaluation-flow.service';
import { Aspirante } from './aspirante.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
import { PruebaHospital } from '../pruebas/entities/prueba-hospital.entity';
import { Prueba } from '../pruebas/entities/prueba.entity';
import {
  ProcesoPrueba,
  PruebaAspirante,
} from '../pruebas/entities/prueba-aspirante.entity';

describe('EvaluationFlowService', () => {
  let service: EvaluationFlowService;

  const aspiranteRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const flowStepRepo = {
    findOne: jest.fn(),
  };
  const pruebaHospitalRepo = {
    find: jest.fn(),
  };
  const pruebaRepo = {
    find: jest.fn(),
  };
  const pruebaAspiranteRepo = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const aspiranteId = 'asp-uuid-1';
  const tenantId = 'tenant-uuid-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationFlowService,
        { provide: getRepositoryToken(Aspirante), useValue: aspiranteRepo },
        {
          provide: getRepositoryToken(EvaluationFlowStep),
          useValue: flowStepRepo,
        },
        {
          provide: getRepositoryToken(PruebaHospital),
          useValue: pruebaHospitalRepo,
        },
        { provide: getRepositoryToken(Prueba), useValue: pruebaRepo },
        {
          provide: getRepositoryToken(PruebaAspirante),
          useValue: pruebaAspiranteRepo,
        },
      ],
    }).compile();

    service = module.get(EvaluationFlowService);
  });

  describe('advanceOneStepIfAt', () => {
    it('no avanza si el aspirante no está en el order_id esperado', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        email: 'a@test.com',
        evaluationFlowStep: { orderId: 4, id: 40, descripcion: 'En evaluación' },
      });

      const result = await service.advanceOneStepIfAt(aspiranteId, 3);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('no avanza si no existe el siguiente paso en catálogo', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        email: 'a@test.com',
        evaluationFlowStep: { orderId: 3, id: 30, descripcion: 'Pagado' },
      });
      flowStepRepo.findOne.mockResolvedValue(null);

      const result = await service.advanceOneStepIfAt(aspiranteId, 3);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('avanza y actualiza evaluation_flow_id', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        email: 'a@test.com',
        evaluationFlowStep: { orderId: 3, id: 30, descripcion: 'Pagado' },
      });
      flowStepRepo.findOne.mockResolvedValue({
        orderId: 4,
        id: 40,
        descripcion: 'En evaluación',
      });
      aspiranteRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.advanceOneStepIfAt(aspiranteId, 3);

      expect(result).toEqual({ advanced: true, newOrderId: 4 });
      expect(aspiranteRepo.update).toHaveBeenCalledWith(
        { id: aspiranteId },
        { evaluationFlowId: 40 },
      );
    });
  });

  describe('setFlowStepToOrderId', () => {
    it('actualiza evaluation_flow_id al paso indicado', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        email: 'a@test.com',
        evaluationFlowStep: { orderId: 7, id: 70, descripcion: 'Paso 7' },
      });
      flowStepRepo.findOne.mockResolvedValue({
        orderId: 10,
        id: 100,
        descripcion: 'Informe',
      });
      aspiranteRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.setFlowStepToOrderId(aspiranteId, 10);

      expect(result).toEqual({ advanced: true, newOrderId: 10 });
      expect(aspiranteRepo.update).toHaveBeenCalledWith(
        { id: aspiranteId },
        { evaluationFlowId: 100 },
      );
    });

    it('es idempotente si el aspirante ya está en el paso objetivo', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        email: 'a@test.com',
        evaluationFlowStep: { orderId: 10, id: 100, descripcion: 'Informe' },
      });
      flowStepRepo.findOne.mockResolvedValue({
        orderId: 10,
        id: 100,
        descripcion: 'Informe',
      });

      const result = await service.setFlowStepToOrderId(aspiranteId, 10);

      expect(result).toEqual({ advanced: true, newOrderId: 10 });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('no avanza si el paso objetivo no existe en catálogo', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        email: 'a@test.com',
        evaluationFlowStep: { orderId: 7, id: 70, descripcion: 'Paso 7' },
      });
      flowStepRepo.findOne.mockResolvedValue(null);

      const result = await service.setFlowStepToOrderId(aspiranteId, 10);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('tryAdvanceFromStep4', () => {
    beforeEach(() => {
      pruebaHospitalRepo.find.mockResolvedValue([
        { idPrueba: 1 },
        { idPrueba: 2 },
      ]);
      pruebaRepo.find.mockResolvedValue([{ idPrueba: 1 }, { idPrueba: 2 }]);
    });

    it('no avanza si falta intento para alguna prueba habilitada', async () => {
      pruebaAspiranteRepo.find.mockResolvedValue([
        { idPrueba: 1, status: ProcesoPrueba.PorEvaluar },
      ]);

      const result = await service.tryAdvanceFromStep4(aspiranteId, tenantId);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('no avanza si alguna prueba sigue en iniciada', async () => {
      pruebaAspiranteRepo.find.mockResolvedValue([
        { idPrueba: 1, status: ProcesoPrueba.PorEvaluar },
        { idPrueba: 2, status: ProcesoPrueba.Iniciada },
      ]);

      const result = await service.tryAdvanceFromStep4(aspiranteId, tenantId);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('avanza 4→5 cuando todas las pruebas habilitadas están finalizadas', async () => {
      pruebaAspiranteRepo.find.mockResolvedValue([
        { idPrueba: 1, status: ProcesoPrueba.PorEvaluar },
        { idPrueba: 2, status: ProcesoPrueba.PorEvaluar },
      ]);
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        email: 'a@test.com',
        evaluationFlowStep: {
          orderId: 4,
          id: 40,
          descripcion: 'En evaluación',
        },
      });
      flowStepRepo.findOne.mockResolvedValue({
        orderId: 5,
        id: 50,
        descripcion: 'Pruebas completadas',
      });
      aspiranteRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.tryAdvanceFromStep4(aspiranteId, tenantId);

      expect(result).toEqual({ advanced: true, newOrderId: 5 });
    });
  });

  describe('tryAdvanceFromStep5', () => {
    beforeEach(() => {
      pruebaHospitalRepo.find.mockResolvedValue([
        { idPrueba: 1 },
        { idPrueba: 2 },
      ]);
      pruebaRepo.find.mockResolvedValue([{ idPrueba: 1 }, { idPrueba: 2 }]);
    });

    it('no avanza si no hay pruebas habilitadas', async () => {
      pruebaHospitalRepo.find.mockResolvedValue([]);

      const result = await service.tryAdvanceFromStep5(aspiranteId, tenantId);

      expect(result).toEqual({ advanced: false });
    });

    it('avanza 5→6 cuando todas las pruebas habilitadas están por_evaluar o posterior', async () => {
      pruebaAspiranteRepo.find.mockResolvedValue([
        { idPrueba: 1, status: ProcesoPrueba.PorEvaluar },
        { idPrueba: 2, status: ProcesoPrueba.PorEvaluar },
      ]);
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        email: 'a@test.com',
        evaluationFlowStep: {
          orderId: 5,
          id: 50,
          descripcion: 'Pruebas completadas',
        },
      });
      flowStepRepo.findOne.mockResolvedValue({
        orderId: 6,
        id: 60,
        descripcion: 'En evaluación',
      });
      aspiranteRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.tryAdvanceFromStep5(aspiranteId, tenantId);

      expect(result).toEqual({ advanced: true, newOrderId: 6 });
    });
  });

  describe('areAllEnabledPruebasFinalized', () => {
    it('devuelve false si falta algún intento', async () => {
      pruebaHospitalRepo.find.mockResolvedValue([{ idPrueba: 1 }]);
      pruebaRepo.find.mockResolvedValue([{ idPrueba: 1 }]);
      pruebaAspiranteRepo.find.mockResolvedValue([]);

      await expect(
        service.areAllEnabledPruebasFinalized(aspiranteId, tenantId),
      ).resolves.toBe(false);
    });

    it('devuelve true cuando todos los intentos están finalizados', async () => {
      pruebaHospitalRepo.find.mockResolvedValue([{ idPrueba: 1 }]);
      pruebaRepo.find.mockResolvedValue([{ idPrueba: 1 }]);
      pruebaAspiranteRepo.find.mockResolvedValue([
        { idPrueba: 1, status: ProcesoPrueba.PorEvaluar },
      ]);

      await expect(
        service.areAllEnabledPruebasFinalized(aspiranteId, tenantId),
      ).resolves.toBe(true);
    });
  });

  describe('countPorEvaluarVsEnabled', () => {
    it('cuenta pruebas habilitadas y intentos por_evaluar', async () => {
      pruebaHospitalRepo.find.mockResolvedValue([
        { idPrueba: 1 },
        { idPrueba: 2 },
        { idPrueba: 3 },
      ]);
      pruebaRepo.find.mockResolvedValue([
        { idPrueba: 1 },
        { idPrueba: 2 },
        { idPrueba: 3 },
      ]);
      pruebaAspiranteRepo.count.mockResolvedValue(1);

      await expect(
        service.countPorEvaluarVsEnabled(aspiranteId, tenantId),
      ).resolves.toEqual({ enabledCount: 3, porEvaluarCount: 1 });

      expect(pruebaAspiranteRepo.count).toHaveBeenCalledWith({
        where: {
          idAspirante: aspiranteId,
          idPrueba: expect.anything(),
          status: ProcesoPrueba.PorEvaluar,
        },
      });
    });

    it('devuelve ceros si no hay pruebas habilitadas', async () => {
      pruebaHospitalRepo.find.mockResolvedValue([]);

      await expect(
        service.countPorEvaluarVsEnabled(aspiranteId, tenantId),
      ).resolves.toEqual({ enabledCount: 0, porEvaluarCount: 0 });
      expect(pruebaAspiranteRepo.count).not.toHaveBeenCalled();
    });
  });
});
