import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  isAspirantePayload,
  JwtPayload,
} from '../../../common/interfaces/jwt-payload.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AspiranteOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user) {
      throw new ForbiddenException('Acceso denegado');
    }

    if (!isAspirantePayload(user)) {
      throw new ForbiddenException('Acceso denegado: se requiere rol aspirante');
    }

    return true;
  }
}
