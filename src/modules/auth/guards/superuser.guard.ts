import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  isAdminPayload,
  JwtPayload,
} from '../../../common/interfaces/jwt-payload.interface';
import { UsuarioAdministrativo } from '../../usuario-administrativo/entities/usuario-administrativo.entity';

@Injectable()
export class SuperuserGuard implements CanActivate {
  constructor(
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user || !isAdminPayload(user)) {
      throw new ForbiddenException('Acceso denegado');
    }

    const usuario = await this.usuarioRepository.findOne({
      where: { id: user.sub, active: true },
      select: ['id', 'isSuperuser'],
    });

    if (!usuario?.isSuperuser) {
      throw new ForbiddenException('Acceso denegado: se requiere superusuario');
    }

    return true;
  }
}
