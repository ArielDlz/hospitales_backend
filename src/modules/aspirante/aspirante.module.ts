import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aspirante } from './aspirante.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
import { AspiranteController } from './aspirante.controller';
import { AspiranteService } from './aspirante.service';
import { EvaluationFlowService } from './evaluation-flow.service';
import { HospitalModule } from '../hospital/hospital.module';
import { MailModule } from '../mail/mail.module';
import { PruebaRespuesta } from '../pruebas/entities/prueba-respuesta.entity';
import { PruebaHospital } from '../pruebas/entities/prueba-hospital.entity';
import { Prueba } from '../pruebas/entities/prueba.entity';
import { PruebaAspirante } from '../pruebas/entities/prueba-aspirante.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';

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
    ]),
    HospitalModule,
    MailModule,
  ],
  controllers: [AspiranteController],
  providers: [AspiranteService, EvaluationFlowService],
  exports: [AspiranteService, EvaluationFlowService],
})
export class AspiranteModule {}
