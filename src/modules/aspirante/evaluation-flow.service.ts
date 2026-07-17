import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Aspirante } from './aspirante.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
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
    @InjectRepository(PruebaHospital)
    private readonly pruebaHospitalRepository: Repository<PruebaHospital>,
    @InjectRepository(Prueba)
    private readonly pruebaRepository: Repository<Prueba>,
    @InjectRepository(PruebaAspirante)
    private readonly pruebaAspiranteRepository: Repository<PruebaAspirante>,
  ) {}

  /**
   * True when every hospital-enabled, active prueba has an attempt in a
   * finalized status (por_evaluar or later).
   */
  async areAllEnabledPruebasFinalized(
    aspiranteId: string,
    tenantId: string,
  ): Promise<boolean> {
    const asignaciones = await this.pruebaHospitalRepository.find({
      where: { tenantId, show: true },
      select: ['idPrueba'],
    });
    if (asignaciones.length === 0) {
      return false;
    }

    const idsPrueba = asignaciones.map((a) => a.idPrueba);
    const pruebasActivas = await this.pruebaRepository.find({
      where: { idPrueba: In(idsPrueba), active: true },
      select: ['idPrueba'],
    });
    if (pruebasActivas.length === 0) {
      return false;
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
      return false;
    }

    const intentoByPrueba = new Map(intentos.map((i) => [i.idPrueba, i.status]));
    return enabledIds.every((idPrueba) => {
      const status = intentoByPrueba.get(idPrueba);
      return status !== undefined && FINALIZED_STATUSES.includes(status);
    });
  }

  async advanceOneStepIfAt(
    aspiranteId: string,
    expectedOrderId: number,
    reason = 'advanceOneStepIfAt',
  ): Promise<FlowAdvanceResult> {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: aspiranteId },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante?.evaluationFlowStep) {
      this.logger.warn(
        `[FLOW_STEP] aspiranteId=${aspiranteId} skip reason=${reason} detail=sin_paso_actual expected=${expectedOrderId}`,
      );
      return { advanced: false };
    }
    if (aspirante.evaluationFlowStep.orderId !== expectedOrderId) {
      this.logger.log(
        `[FLOW_STEP] aspiranteId=${aspiranteId} email=${aspirante.email} skip reason=${reason} detail=order_id_no_coincide actual=${aspirante.evaluationFlowStep.orderId} expected=${expectedOrderId}`,
      );
      return { advanced: false };
    }

    const nextStep = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: expectedOrderId + 1 },
    });
    if (!nextStep) {
      this.logger.warn(
        `[FLOW_STEP] aspiranteId=${aspiranteId} skip reason=${reason} detail=siguiente_paso_inexistente expectedNext=${expectedOrderId + 1}`,
      );
      return { advanced: false };
    }

    const updateResult = await this.aspiranteRepository.update(
      { id: aspiranteId },
      { evaluationFlowId: nextStep.id },
    );
    if (!updateResult.affected) {
      this.logger.warn(
        `[FLOW_STEP] aspiranteId=${aspiranteId} skip reason=${reason} detail=update_sin_filas ${expectedOrderId}→${nextStep.orderId}`,
      );
      return { advanced: false };
    }

    this.logStepChange({
      aspiranteId,
      email: aspirante.email,
      fromOrderId: expectedOrderId,
      fromDescripcion: aspirante.evaluationFlowStep.descripcion,
      toOrderId: nextStep.orderId,
      toDescripcion: nextStep.descripcion,
      reason,
    });
    return { advanced: true, newOrderId: nextStep.orderId };
  }

  async setFlowStepToOrderId(
    aspiranteId: string,
    targetOrderId: number,
    reason = 'setFlowStepToOrderId',
  ): Promise<FlowAdvanceResult> {
    const aspirante = await this.aspiranteRepository.findOne({
      where: { id: aspiranteId },
      relations: ['evaluationFlowStep'],
    });
    if (!aspirante?.evaluationFlowStep) {
      this.logger.warn(
        `[FLOW_STEP] aspiranteId=${aspiranteId} skip reason=${reason} detail=sin_paso_actual target=${targetOrderId}`,
      );
      return { advanced: false };
    }

    const targetStep = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: targetOrderId },
    });
    if (!targetStep) {
      this.logger.warn(
        `[FLOW_STEP] aspiranteId=${aspiranteId} skip reason=${reason} detail=paso_objetivo_inexistente target=${targetOrderId}`,
      );
      return { advanced: false };
    }

    if (aspirante.evaluationFlowStep.orderId === targetOrderId) {
      this.logger.log(
        `[FLOW_STEP] aspiranteId=${aspiranteId} email=${aspirante.email} idempotent reason=${reason} order_id=${targetOrderId} ("${targetStep.descripcion}")`,
      );
      return { advanced: true, newOrderId: targetOrderId };
    }

    const previousOrderId = aspirante.evaluationFlowStep.orderId;
    const previousDescripcion = aspirante.evaluationFlowStep.descripcion;
    const updateResult = await this.aspiranteRepository.update(
      { id: aspiranteId },
      { evaluationFlowId: targetStep.id },
    );
    if (!updateResult.affected) {
      this.logger.warn(
        `[FLOW_STEP] aspiranteId=${aspiranteId} skip reason=${reason} detail=update_sin_filas ${previousOrderId}→${targetOrderId}`,
      );
      return { advanced: false };
    }

    this.logStepChange({
      aspiranteId,
      email: aspirante.email,
      fromOrderId: previousOrderId,
      fromDescripcion: previousDescripcion,
      toOrderId: targetOrderId,
      toDescripcion: targetStep.descripcion,
      reason,
    });
    return { advanced: true, newOrderId: targetOrderId };
  }

  /**
   * Advances 4 → 5 only when all enabled hospital pruebas are finalized.
   */
  async tryAdvanceFromStep4(
    aspiranteId: string,
    tenantId: string,
  ): Promise<FlowAdvanceResult> {
    const allFinalized = await this.areAllEnabledPruebasFinalized(
      aspiranteId,
      tenantId,
    );
    if (!allFinalized) {
      this.logger.log(
        `[FLOW_STEP] aspiranteId=${aspiranteId} tenantId=${tenantId} skip reason=tryAdvanceFromStep4 detail=pruebas_incompletas expected=4→5`,
      );
      return { advanced: false };
    }
    return this.advanceOneStepIfAt(
      aspiranteId,
      4,
      'tryAdvanceFromStep4:todas_pruebas_finalizadas',
    );
  }

  /**
   * Advances 5 → 6 when all enabled hospital pruebas are finalized.
   * Kept for callers that finalize the last prueba while already at step 5.
   */
  async tryAdvanceFromStep5(
    aspiranteId: string,
    tenantId: string,
  ): Promise<FlowAdvanceResult> {
    const allFinalized = await this.areAllEnabledPruebasFinalized(
      aspiranteId,
      tenantId,
    );
    if (!allFinalized) {
      this.logger.log(
        `[FLOW_STEP] aspiranteId=${aspiranteId} tenantId=${tenantId} skip reason=tryAdvanceFromStep5 detail=pruebas_incompletas expected=5→6`,
      );
      return { advanced: false };
    }
    return this.advanceOneStepIfAt(
      aspiranteId,
      5,
      'tryAdvanceFromStep5:todas_pruebas_finalizadas',
    );
  }

  private logStepChange(params: {
    aspiranteId: string;
    email: string;
    fromOrderId: number;
    fromDescripcion?: string | null;
    toOrderId: number;
    toDescripcion?: string | null;
    reason: string;
  }): void {
    const fromLabel = params.fromDescripcion
      ? `${params.fromOrderId} ("${params.fromDescripcion}")`
      : String(params.fromOrderId);
    const toLabel = params.toDescripcion
      ? `${params.toOrderId} ("${params.toDescripcion}")`
      : String(params.toOrderId);
    this.logger.log(
      `[FLOW_STEP_CHANGE] aspiranteId=${params.aspiranteId} email=${params.email} ${fromLabel} → ${toLabel} reason=${params.reason}`,
    );
  }
}
