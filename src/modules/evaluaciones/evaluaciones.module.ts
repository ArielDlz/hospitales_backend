import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { InformePdfService } from './informe-pdf.service';
import { Veredicto } from './entities/veredicto.entity';
import { PruebaAspiranteEvaluacion } from './entities/prueba-aspirante-evaluacion.entity';
import { AspiranteEvaluacion } from './entities/aspirante-evaluacion.entity';
import { Aspirante } from '../aspirante/aspirante.entity';
import { PruebaAspirante } from '../pruebas/entities/prueba-aspirante.entity';
import { Prueba } from '../pruebas/entities/prueba.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { Hospital } from '../hospital/hospital.entity';
import { AuthModule } from '../auth/auth.module';
import { AspiranteModule } from '../aspirante/aspirante.module';
import { PruebasModule } from '../pruebas/pruebas.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Veredicto,
      PruebaAspiranteEvaluacion,
      AspiranteEvaluacion,
      Aspirante,
      PruebaAspirante,
      Prueba,
      UsuarioAdministrativo,
      Hospital,
    ]),
    AuthModule,
    AspiranteModule,
    PruebasModule,
    StorageModule,
  ],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService, InformePdfService],
})
export class EvaluacionesModule {}
