import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Aspirante } from './aspirante.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
import { PruebaRespuesta } from '../pruebas/entities/prueba-respuesta.entity';
import { PruebaHospital } from '../pruebas/entities/prueba-hospital.entity';
import { Prueba } from '../pruebas/entities/prueba.entity';
import {
  ProcesoPrueba,
  PruebaAspirante,
} from '../pruebas/entities/prueba-aspirante.entity';

export type FlowAdvanceResult = {
  advanced: boolean;
  newOrderId?: number;
};

const FINALIZED_STATUSES: ProcesoPrueba[] = [
  ProcesoPrueba.PorEvaluar,
  ProcesoPrueba.Revisada,
  ProcesoPrueba.Evaluada,
  ProcesoPrueba.ReporteGenerado,
  ProcesoPrueba.Finalizada,
];

@Injectable()
export class EvaluationFlowService {
  private readonly logger = new Logger(EvaluationFlowService.name);

  constructor(
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    @InjectRepository(EvaluationFlowStep)
    private readonly evaluationFlowStepRepository: Repository<EvaluationFlowStep>,
    @InjectRepository(PruebaRespuesta)
    private readonly pruebaRespuestaRepository: Repository<PruebaRespuesta>,
    @InjectRepository(PruebaHospital)
    private readonly pruebaHospitalRepository: Repository<PruebaHospital>,
    @InjectRepository(Prueba)
    private readonly pruebaRepository: Repository<Prueba>,
    @InjectRepository(PruebaAspirante)
    private readonly pruebaAspiranteRepository: Repository<PruebaAspirante>,
  ) {}

  async advanceOneStepIfAt(
    aspiranteId: string,
    expectedOrderId: number,
  ): Promise<FlowAdvanceResult> {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: aspiranteId },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante?.evaluationFlowStep) {
      return { advanced: false };
    }
    if (aspirante.evaluationFlowStep.orderId !== expectedOrderId) {
      return { advanced: false };
    }

    const nextStep = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: expectedOrderId + 1 },
    });
    if (!nextStep) {
      this.logger.warn(
        `No existe paso evaluation_flow_steps con order_id = ${expectedOrderId + 1}`,
      );
      return { advanced: false };
    }

    const updateResult = await this.aspiranteRepository.update(
      { id: aspiranteId },
      { evaluationFlowId: nextStep.id },
    );
    if (!updateResult.affected) {
      return { advanced: false };
    }

    this.logger.log(
      `Flujo aspirante ${aspiranteId}: order_id ${expectedOrderId} → ${nextStep.orderId}`,
    );
    return { advanced: true, newOrderId: nextStep.orderId };
  }

  async setFlowStepToOrderId(
    aspiranteId: string,
    targetOrderId: number,
  ): Promise<FlowAdvanceResult> {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: aspiranteId },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante?.evaluationFlowStep) {
      return { advanced: false };
    }

    const targetStep = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: targetOrderId },
    });
    if (!targetStep) {
      this.logger.warn(
        `No existe paso evaluation_flow_steps con order_id = ${targetOrderId}`,
      );
      return { advanced: false };
    }

    if (aspirante.evaluationFlowStep.orderId === targetOrderId) {
      return { advanced: true, newOrderId: targetOrderId };
    }

    const previousOrderId = aspirante.evaluationFlowStep.orderId;
    const updateResult = await this.aspiranteRepository.update(
      { id: aspiranteId },
      { evaluationFlowId: targetStep.id },
    );
    if (!updateResult.affected) {
      return { advanced: false };
    }

    this.logger.log(
      `Flujo aspirante ${aspiranteId}: order_id ${previousOrderId} → ${targetOrderId}`,
    );
    return { advanced: true, newOrderId: targetOrderId };
  }

  async tryAdvanceFromStep4(
    aspiranteId: string,
    idPruebaAspirante: number,
  ): Promise<FlowAdvanceResult> {
    const respuestaCount = await this.pruebaRespuestaRepository.count({
      where: { idPruebaAspirante },
    });
    if (respuestaCount !== 1) {
      return { advanced: false };
    }
    return this.advanceOneStepIfAt(aspiranteId, 4);
  }

  async tryAdvanceFromStep5(
    aspiranteId: string,
    tenantId: string,
  ): Promise<FlowAdvanceResult> {
    const asignaciones = await this.pruebaHospitalRepository.find({
      where: { tenantId, show: true },
      select: ['idPrueba'],
    });
    if (asignaciones.length === 0) {
      return { advanced: false };
    }

    const idsPrueba = asignaciones.map((a) => a.idPrueba);
    const pruebasActivas = await this.pruebaRepository.find({
      where: { idPrueba: In(idsPrueba), active: true },
      select: ['idPrueba'],
    });
    if (pruebasActivas.length === 0) {
      return { advanced: false };
    }

    const enabledIds = pruebasActivas.map((p) => p.idPrueba);
    const intentos = await this.pruebaAspiranteRepository.find({
      where: {
        idAspirante: aspiranteId,
        idPrueba: In(enabledIds),
      },
      select: ['idPrueba', 'status'],
    });

    if (intentos.length !== enabledIds.length) {
      return { advanced: false };
    }

    const intentoByPrueba = new Map(intentos.map((i) => [i.idPrueba, i.status]));
    const allFinalized = enabledIds.every((idPrueba) => {
      const status = intentoByPrueba.get(idPrueba);
      return status !== undefined && FINALIZED_STATUSES.includes(status);
    });
    if (!allFinalized) {
      return { advanced: false };
    }

    return this.advanceOneStepIfAt(aspiranteId, 5);
  }
}
