import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudAcceso } from './solicitud-acceso.entity';
import { Aspirante } from '../aspirante/aspirante.entity';
import { HospitalModule } from '../hospital/hospital.module';
import { SolicitudesAccesoController } from './solicitudes-acceso.controller';
import { SolicitudesAccesoService } from './solicitudes-acceso.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SolicitudAcceso, Aspirante]),
    HospitalModule,
  ],
  controllers: [SolicitudesAccesoController],
  providers: [SolicitudesAccesoService],
  exports: [SolicitudesAccesoService],
})
export class SolicitudesAccesoModule {}
