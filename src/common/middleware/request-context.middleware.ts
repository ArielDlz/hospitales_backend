import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  resolveIncomingRequestId,
} from '../logging/request-log.util';
import { runWithRequestContext } from '../request-context';

/**
 * Establishes AsyncLocalStorage for the full Express/Nest request lifetime.
 *
 * Interceptors alone are not enough: returning `next.handle()` from inside
 * `AsyncLocalStorage.run()` ends the ALS scope before Nest subscribes, so
 * `getRequestId()` is undefined in async controller/service work.
 *
 * Honors an incoming X-Request-Id (or X-Correlation-Id) when present so
 * clients can correlate their own id with server logs.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = resolveIncomingRequestId(req) ?? randomUUID().slice(0, 8);
    res.setHeader(REQUEST_ID_HEADER, requestId);
    runWithRequestContext({ requestId, startedAt: Date.now() }, () => next());
  }
}
