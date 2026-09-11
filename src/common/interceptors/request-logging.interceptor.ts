import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  describeHttpError,
  formatActor,
  LoggedRequest,
  REQUEST_ERROR_LOGGED_KEY,
  serializeForLog,
} from '../logging/request-log.util';
import { getRequestElapsedMs, getRequestId } from '../request-context';

const SKIP_EXACT = new Set(['/', '/api', '/api-json']);

function shouldSkip(method: string, path: string): boolean {
  if (method === 'OPTIONS') return true;
  const normalized = path.split('?')[0] || '/';
  if (SKIP_EXACT.has(normalized)) return true;
  if (normalized.startsWith('/api-json')) return true;
  return false;
}

function endpointPath(req: LoggedRequest): string {
  return req.originalUrl || req.url || '/';
}

function handlerName(context: ExecutionContext): string {
  const controller = context.getClass()?.name;
  const handler = context.getHandler()?.name;
  if (controller && handler) return `${controller}.${handler}`;
  return handler || controller || '(unknown)';
}

function hasLoggableBody(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  if (typeof body !== 'object') return true;
  if (Array.isArray(body)) return body.length > 0;
  return Object.keys(body).length > 0;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLogging');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<LoggedRequest>();
    const res = http.getResponse<Response>();
    const method = req.method;
    const path = endpointPath(req);

    if (shouldSkip(method, path)) {
      return next.handle();
    }

    const requestId = getRequestId() ?? randomUUID().slice(0, 8);
    const actorLine = formatActor(req.user, req.body);
    const handler = handlerName(context);

    this.logger.log(
      `[${requestId}] START ${method} ${path} handler=${handler} ${actorLine}`,
    );

    if (hasLoggableBody(req.body)) {
      this.logger.log(`[${requestId}] request=${serializeForLog(req.body)}`);
    }

    return next.handle().pipe(
      tap((data) => {
        const durationMs = getRequestElapsedMs() ?? 0;
        this.logger.log(
          `[${requestId}] END ${res.statusCode} ${durationMs}ms ${actorLine} response=${serializeForLog(data)}`,
        );
      }),
      catchError((err: unknown) => {
        req[REQUEST_ERROR_LOGGED_KEY] = true;
        const durationMs = getRequestElapsedMs() ?? 0;
        const info = describeHttpError(err);
        this.logger.warn(
          `[${requestId}] ERROR ${info.status} ${durationMs}ms ${method} ${path} ${actorLine} error=${info.name} message=${info.message} response=${serializeForLog(info.response)}`,
        );
        return throwError(() => err);
      }),
    );
  }
}
