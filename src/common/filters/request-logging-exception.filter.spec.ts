import { UnauthorizedException, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { RequestLoggingExceptionFilter } from './request-logging-exception.filter';
import { REQUEST_ERROR_LOGGED_KEY } from '../logging/request-log.util';
import { runWithRequestContext } from '../request-context';

describe('RequestLoggingExceptionFilter', () => {
  const httpAdapterHost = {
    httpAdapter: {},
  } as unknown as HttpAdapterHost;
  const filter = new RequestLoggingExceptionFilter(httpAdapterHost);
  let warns: string[];

  beforeEach(() => {
    warns = [];
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((message: unknown) => {
        warns.push(String(message));
      });
    jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function host(
    req: Record<string, unknown>,
    res: Record<string, unknown> = {},
  ) {
    return {
      getType: () => 'http' as const,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    };
  }

  it('logs guard-level errors with request id, endpoint and actor', () => {
    const req = {
      method: 'POST',
      originalUrl: '/pruebas/aspirantes/respuestas',
      body: {},
    };
    const err = new UnauthorizedException('Unauthorized');

    runWithRequestContext(
      { requestId: 'guard-1', startedAt: Date.now() },
      () => {
        filter.catch(err, host(req) as never);
      },
    );

    expect(warns.some((line) => line.includes('[guard-1] ERROR 401'))).toBe(
      true,
    );
    expect(
      warns.some((line) =>
        line.includes('POST /pruebas/aspirantes/respuestas'),
      ),
    ).toBe(true);
    expect(
      warns.some((line) => line.includes('error=UnauthorizedException')),
    ).toBe(true);
    expect(req[REQUEST_ERROR_LOGGED_KEY]).toBe(true);
  });

  it('does not log again when the interceptor already logged the error', () => {
    const req = {
      method: 'POST',
      originalUrl: '/pruebas/aspirantes/respuestas',
      [REQUEST_ERROR_LOGGED_KEY]: true,
      body: {},
    };

    runWithRequestContext({ requestId: 'dup-1', startedAt: Date.now() }, () => {
      filter.catch(new UnauthorizedException(), host(req) as never);
    });

    expect(warns.some((line) => line.includes('[dup-1] ERROR'))).toBe(false);
  });
});
