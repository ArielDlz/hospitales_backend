import { ArgumentsHost, Catch, Injectable, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import {
  describeHttpError,
  formatActor,
  LoggedRequest,
  REQUEST_ERROR_LOGGED_KEY,
  serializeForLog,
} from '../logging/request-log.util';
import { getRequestElapsedMs, getRequestId } from '../request-context';

/**
 * Logs HTTP errors that never reach the request interceptor (e.g. JWT guard
 * 401s). Handler errors are already logged by RequestLoggingInterceptor.
 */
@Catch()
@Injectable()
export class RequestLoggingExceptionFilter extends BaseExceptionFilter {
  private readonly requestLogger = new Logger('RequestLogging');

  constructor(httpAdapterHost: HttpAdapterHost) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      this.logIfUnhandled(exception, host);
    }
    super.catch(exception, host);
  }

  private logIfUnhandled(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<LoggedRequest>();
    if (req[REQUEST_ERROR_LOGGED_KEY]) {
      return;
    }
    req[REQUEST_ERROR_LOGGED_KEY] = true;

    const requestId = getRequestId() ?? 'unknown';
    const durationMs = getRequestElapsedMs() ?? 0;
    const method = req.method || '?';
    const path = req.originalUrl || req.url || '/';
    const actorLine = formatActor(req.user, req.body);
    const info = describeHttpError(exception);

    this.requestLogger.warn(
      `[${requestId}] ERROR ${info.status} ${durationMs}ms ${method} ${path} ${actorLine} error=${info.name} message=${info.message} response=${serializeForLog(info.response)}`,
    );
  }
}
