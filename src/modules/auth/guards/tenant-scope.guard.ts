import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { JwtPayloadAspirante } from '../../../common/interfaces/jwt-payload.interface';

/**
 * Asegura que el tenantId del request (param, header o body) coincida con el del token.
 * Solo aplicar en rutas de aspirante.
 */
@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayloadAspirante | undefined;

    if (!user || user.type !== 'aspirante') {
      return true; // Dejar que AspiranteOnlyGuard maneje
    }

    const requestTenantId =
      request.params?.tenantId ||
      request.params?.tenant_id ||
      request.headers?.['x-tenant-id'] ||
      request.body?.tenantId;

    if (requestTenantId && requestTenantId !== user.tenantId) {
      throw new ForbiddenException('Acceso denegado: tenant no autorizado');
    }

    return true;
  }
}
