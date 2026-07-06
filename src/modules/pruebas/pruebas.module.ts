import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prueba } from './entities/prueba.entity';
import { PruebaHospital } from './entities/prueba-hospital.entity';
import { PruebaAspirante } from './entities/prueba-aspirante.entity';
import { PruebaRespuesta } from './entities/prueba-respuesta.entity';
import { PruebaRespuestaOpcion } from './entities/prueba-respuesta-opcion.entity';
import { Pregunta } from './entities/pregunta.entity';
import { PreguntaOpcion } from './entities/pregunta-opcion.entity';
import { PreguntaTipo } from './entities/pregunta-tipo.entity';
import { Hospital } from '../hospital/hospital.entity';
import { Aspirante } from '../aspirante/aspirante.entity';
import { PruebasController } from './pruebas.controller';
import { PruebasHospitalesController } from './pruebas-hospitales.controller';
import { PruebasAspirantesController } from './pruebas-aspirantes.controller';
import { PruebasService } from './pruebas.service';
import { AuthModule } from '../auth/auth.module';
import { AspiranteModule } from '../aspirante/aspirante.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Prueba,
      PruebaHospital,
      PruebaAspirante,
      PruebaRespuesta,
      PruebaRespuestaOpcion,
      Pregunta,
      PreguntaOpcion,
      PreguntaTipo,
      Hospital,
      Aspirante,
    ]),
    AuthModule,
    AspiranteModule,
    StorageModule,
  ],
  controllers: [
    PruebasController,
    PruebasHospitalesController,
    PruebasAspirantesController,
  ],
  providers: [PruebasService],
  exports: [PruebasService],
})
export class PruebasModule {}
