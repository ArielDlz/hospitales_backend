import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioAdministrativo } from './entities/usuario-administrativo.entity';
import { EvaluadorTenant } from './entities/evaluador-tenant.entity';
import { UsuarioAdministrativoController } from './usuario-administrativo.controller';
import { UsuarioAdministrativoService } from './usuario-administrativo.service';
import { Hospital } from '../hospital/hospital.entity';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsuarioAdministrativo, EvaluadorTenant, Hospital]),
    AuthModule,
    MailModule,
  ],
  controllers: [UsuarioAdministrativoController],
  providers: [UsuarioAdministrativoService],
  exports: [UsuarioAdministrativoService],
})
export class UsuarioAdministrativoModule {}
