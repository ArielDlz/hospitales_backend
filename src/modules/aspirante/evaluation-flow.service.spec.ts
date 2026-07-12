import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EvaluationFlowService } from './evaluation-flow.service';
import { Aspirante } from './aspirante.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
import { PruebaRespuesta } from '../pruebas/entities/prueba-respuesta.entity';
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
  const respuestaRepo = {
    count: jest.fn(),
  };
  const pruebaHospitalRepo = {
    find: jest.fn(),
  };
  const pruebaRepo = {
    find: jest.fn(),
  };
  const pruebaAspiranteRepo = {
    find: jest.fn(),
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
          provide: getRepositoryToken(PruebaRespuesta),
          useValue: respuestaRepo,
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
        evaluationFlowStep: { orderId: 4, id: 40 },
      });

      const result = await service.advanceOneStepIfAt(aspiranteId, 3);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('no avanza si no existe el siguiente paso en catálogo', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        evaluationFlowStep: { orderId: 3, id: 30 },
      });
      flowStepRepo.findOne.mockResolvedValue(null);

      const result = await service.advanceOneStepIfAt(aspiranteId, 3);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('avanza y actualiza evaluation_flow_id', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        evaluationFlowStep: { orderId: 3, id: 30 },
      });
      flowStepRepo.findOne.mockResolvedValue({ orderId: 4, id: 40 });
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
        evaluationFlowStep: { orderId: 7, id: 70 },
      });
      flowStepRepo.findOne.mockResolvedValue({ orderId: 10, id: 100 });
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
        evaluationFlowStep: { orderId: 10, id: 100 },
      });
      flowStepRepo.findOne.mockResolvedValue({ orderId: 10, id: 100 });

      const result = await service.setFlowStepToOrderId(aspiranteId, 10);

      expect(result).toEqual({ advanced: true, newOrderId: 10 });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('no avanza si el paso objetivo no existe en catálogo', async () => {
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        evaluationFlowStep: { orderId: 7, id: 70 },
      });
      flowStepRepo.findOne.mockResolvedValue(null);

      const result = await service.setFlowStepToOrderId(aspiranteId, 10);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('tryAdvanceFromStep4', () => {
    it('no avanza si no es la primera respuesta del intento', async () => {
      respuestaRepo.count.mockResolvedValue(2);

      const result = await service.tryAdvanceFromStep4(aspiranteId, 10);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.findOne).not.toHaveBeenCalled();
    });

    it('avanza 4→5 en la primera respuesta del intento', async () => {
      respuestaRepo.count.mockResolvedValue(1);
      aspiranteRepo.findOne.mockResolvedValue({
        id: aspiranteId,
        evaluationFlowStep: { orderId: 4, id: 40 },
      });
      flowStepRepo.findOne.mockResolvedValue({ orderId: 5, id: 50 });
      aspiranteRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.tryAdvanceFromStep4(aspiranteId, 10);

      expect(result).toEqual({ advanced: true, newOrderId: 5 });
    });
  });

  describe('tryAdvanceFromStep5', () => {
    beforeEach(() => {
      pruebaHospitalRepo.find.mockResolvedValue([{ idPrueba: 1 }, { idPrueba: 2 }]);
      pruebaRepo.find.mockResolvedValue([
        { idPrueba: 1 },
        { idPrueba: 2 },
      ]);
    });

    it('no avanza si falta intento para alguna prueba habilitada', async () => {
      pruebaAspiranteRepo.find.mockResolvedValue([
        { idPrueba: 1, status: ProcesoPrueba.PorEvaluar },
      ]);

      const result = await service.tryAdvanceFromStep5(aspiranteId, tenantId);

      expect(result).toEqual({ advanced: false });
      expect(aspiranteRepo.update).not.toHaveBeenCalled();
    });

    it('no avanza si alguna prueba sigue en iniciada', async () => {
      pruebaAspiranteRepo.find.mockResolvedValue([
        { idPrueba: 1, status: ProcesoPrueba.PorEvaluar },
        { idPrueba: 2, status: ProcesoPrueba.Iniciada },
      ]);

      const result = await service.tryAdvanceFromStep5(aspiranteId, tenantId);

      expect(result).toEqual({ advanced: false });
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
        evaluationFlowStep: { orderId: 5, id: 50 },
      });
      flowStepRepo.findOne.mockResolvedValue({ orderId: 6, id: 60 });
      aspiranteRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.tryAdvanceFromStep5(aspiranteId, tenantId);

      expect(result).toEqual({ advanced: true, newOrderId: 6 });
    });
  });
});
