import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aspirante } from './aspirante.entity';
import { AspiranteController } from './aspirante.controller';
import { AspiranteService } from './aspirante.service';
import { HospitalModule } from '../hospital/hospital.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Aspirante]),
    HospitalModule,
    MailModule,
  ],
  controllers: [AspiranteController],
  providers: [AspiranteService],
  exports: [AspiranteService],
})
export class AspiranteModule {}
