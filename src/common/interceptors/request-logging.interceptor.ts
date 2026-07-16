import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  isAdminPayload,
  isAspirantePayload,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';
import { runWithRequestContext } from '../request-context';

const SKIP_EXACT = new Set(['/', '/api', '/api-json']);

function shouldSkip(method: string, path: string): boolean {
  if (method === 'OPTIONS') return true;
  const normalized = path.split('?')[0] || '/';
  if (SKIP_EXACT.has(normalized)) return true;
  if (normalized.startsWith('/api-json')) return true;
  return false;
}

function formatActor(user: JwtPayload | undefined): string {
  if (!user) return 'actor=anonymous';
  if (isAspirantePayload(user)) {
    return [
      'actor=aspirante',
      `id=${user.sub}`,
      `nombre=${user.nombre}`,
      `slug=${user.slug}`,
      `registro=${user.registro}`,
      `flowOrderId=${user.evaluationFlowOrderId ?? '(n/a)'}`,
    ].join(' ');
  }
  if (isAdminPayload(user)) {
    return `actor=admin id=${user.sub} rol=${user.rol}`;
  }
  return 'actor=unknown';
}

function shortActor(user: JwtPayload | undefined): string {
  if (!user) return 'actor=anonymous';
  if (isAspirantePayload(user)) {
    return `aspirante=${user.sub} slug=${user.slug}`;
  }
  if (isAdminPayload(user)) {
    return `admin=${user.sub}`;
  }
  return 'actor=unknown';
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLogging');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: JwtPayload }>();
    const res = http.getResponse<Response>();
    const method = req.method;
    const path = req.originalUrl?.split('?')[0] || req.url?.split('?')[0] || '/';

    if (shouldSkip(method, path)) {
      return next.handle();
    }

    const requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const actorLine = formatActor(req.user);
    const actorShort = shortActor(req.user);

    this.logger.log(
      `---------- Start request [${requestId}] ${method} ${path} ----------`,
    );
    this.logger.log(`[${requestId}] ${actorLine}`);

    // Keep ALS active across async RxJS subscription so AuthService can read reqId
    return new Observable((subscriber) => {
      let innerSub: { unsubscribe: () => void } | undefined;
      runWithRequestContext({ requestId }, () => {
        innerSub = next
          .handle()
          .pipe(
            tap(() => {
              const durationMs = Date.now() - startedAt;
              this.logger.log(
                `---------- End request [${requestId}] ${res.statusCode} ${durationMs}ms ${actorShort} ----------`,
              );
            }),
            catchError((err: unknown) => {
              const durationMs = Date.now() - startedAt;
              const status =
                err instanceof HttpException
                  ? err.getStatus()
                  : res.statusCode || 500;
              const errorName =
                err instanceof Error ? err.constructor.name : 'Error';
              this.logger.warn(
                `---------- End request [${requestId}] ${status} ${durationMs}ms ${actorShort} error=${errorName} ----------`,
              );
              return throwError(() => err);
            }),
          )
          .subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
      });
      return () => innerSub?.unsubscribe();
    });
  }
}
