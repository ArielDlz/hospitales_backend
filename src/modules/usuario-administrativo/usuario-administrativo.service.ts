import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioAdministrativo } from './entities/usuario-administrativo.entity';
import { EvaluadorTenant } from './entities/evaluador-tenant.entity';

@Injectable()
export class UsuarioAdministrativoService {
  constructor(
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
    @InjectRepository(EvaluadorTenant)
    private readonly evaluadorTenantRepository: Repository<EvaluadorTenant>,
  ) {}
}
