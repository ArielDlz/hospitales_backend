import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioAdministrativo } from './entities/usuario-administrativo.entity';
import { EvaluadorTenant } from './entities/evaluador-tenant.entity';
import { UsuarioAdministrativoController } from './usuario-administrativo.controller';
import { UsuarioAdministrativoService } from './usuario-administrativo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsuarioAdministrativo, EvaluadorTenant]),
  ],
  controllers: [UsuarioAdministrativoController],
  providers: [UsuarioAdministrativoService],
  exports: [UsuarioAdministrativoService],
})
export class UsuarioAdministrativoModule {}
