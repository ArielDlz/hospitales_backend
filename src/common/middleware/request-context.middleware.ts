import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../request-context';

/**
 * Establishes AsyncLocalStorage for the full Express/Nest request lifetime.
 *
 * Interceptors alone are not enough: returning `next.handle()` from inside
 * `AsyncLocalStorage.run()` ends the ALS scope before Nest subscribes, so
 * `getRequestId()` is undefined in async controller/service work.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    const requestId = randomUUID().slice(0, 8);
    runWithRequestContext({ requestId }, () => next());
  }
}
