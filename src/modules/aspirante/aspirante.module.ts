import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aspirante } from './aspirante.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
import { AspiranteController } from './aspirante.controller';
import { AspiranteService } from './aspirante.service';
import { AspiranteImportService } from './import/aspirante-import.service';
import { EvaluationFlowService } from './evaluation-flow.service';
import { HospitalModule } from '../hospital/hospital.module';
import { MailModule } from '../mail/mail.module';
import { PruebaRespuesta } from '../pruebas/entities/prueba-respuesta.entity';
import { PruebaHospital } from '../pruebas/entities/prueba-hospital.entity';
import { Prueba } from '../pruebas/entities/prueba.entity';
import { PruebaAspirante } from '../pruebas/entities/prueba-aspirante.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { Payment } from '../payments/entities/payment.entity';
import { AspiranteEvaluacion } from '../evaluaciones/entities/aspirante-evaluacion.entity';
import { SuperuserGuard } from '../auth/guards/superuser.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Aspirante,
      EvaluationFlowStep,
      PruebaRespuesta,
      PruebaHospital,
      Prueba,
      PruebaAspirante,
      UsuarioAdministrativo,
      Payment,
      AspiranteEvaluacion,
    ]),
    HospitalModule,
    MailModule,
  ],
  controllers: [AspiranteController],
  providers: [
    AspiranteService,
    AspiranteImportService,
    EvaluationFlowService,
    SuperuserGuard,
  ],
  exports: [AspiranteService, EvaluationFlowService],
})
export class AspiranteModule {}
