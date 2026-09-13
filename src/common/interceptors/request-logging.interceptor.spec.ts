import { BadRequestException, ExecutionContext, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { RolUsuarioAdmin } from '../enums/rol-usuario-admin.enum';
import {
  JwtPayloadAdmin,
  JwtPayloadAspirante,
} from '../interfaces/jwt-payload.interface';
import { runWithRequestContext } from '../request-context';
import { REQUEST_ERROR_LOGGED_KEY } from '../logging/request-log.util';

class PruebasAspirantesController {}

function createRespuesta() {
  return undefined;
}

function createContext(
  req: Record<string, unknown>,
  res: { statusCode: number },
): ExecutionContext {
  return {
    getType: () => 'http',
    getClass: () => PruebasAspirantesController,
    getHandler: () => createRespuesta,
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

describe('RequestLoggingInterceptor', () => {
  const interceptor = new RequestLoggingInterceptor();
  let logs: string[];
  let warns: string[];

  beforeEach(() => {
    logs = [];
    warns = [];
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((message: unknown) => {
        logs.push(String(message));
      });
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((message: unknown) => {
        warns.push(String(message));
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs actor email, endpoint, request id and response on success', async () => {
    const user: JwtPayloadAspirante = {
      sub: 'aac4dd5e-80cc-49f4-a97d-58bbb7ddc3b5',
      type: 'aspirante',
      email: 'ana@hospital.com',
      tenantId: 't1',
      slug: 'hospitalgeneral',
      registro: '260276',
      nombre: 'ANA PATRICIA ALVIRA JERONIMO',
      evaluationFlowOrderId: 4,
    };
    const req = {
      method: 'POST',
      originalUrl: '/pruebas/aspirantes/respuestas',
      user,
      body: { idPruebaAspirante: 12, idPregunta: 5, respuesta: 'A' },
    };
    const res = { statusCode: 201 };
    const context = createContext(req, res);

    await runWithRequestContext(
      { requestId: '59e6ac1e', startedAt: Date.now() },
      async () => {
        await lastValueFrom(
          interceptor.intercept(context, {
            handle: () => of({ id: 44, status: 'ok' }),
          }),
        );
      },
    );

    expect(logs[0]).toContain(
      '[59e6ac1e] START POST /pruebas/aspirantes/respuestas',
    );
    expect(logs[0]).toContain(
      'handler=PruebasAspirantesController.createRespuesta',
    );
    expect(logs[0]).toContain(
      'actor=aspirante id=aac4dd5e-80cc-49f4-a97d-58bbb7ddc3b5',
    );
    expect(logs[0]).toContain('email=ana@hospital.com');
    expect(logs[1]).toContain('request=');
    expect(logs[1]).toContain('"idPregunta":5');
    expect(logs[2]).toContain('[59e6ac1e] END 201');
    expect(logs[2]).toContain('response={"id":44,"status":"ok"}');
  });

  it('logs evaluador by id and email', async () => {
    const user: JwtPayloadAdmin = {
      sub: 'eval-1',
      type: 'admin',
      email: 'eva@hospital.com',
      rol: RolUsuarioAdmin.Evaluador,
      signature: false,
      supervisorId: null,
      supervisedUserIds: [],
    };
    const req = {
      method: 'GET',
      originalUrl: '/evaluaciones/workspace/asp-1',
      user,
      body: {},
    };
    const context = createContext(req, { statusCode: 200 });

    await runWithRequestContext(
      { requestId: 'abc12345', startedAt: Date.now() },
      async () => {
        await lastValueFrom(
          interceptor.intercept(context, {
            handle: () => of({ readOnly: false }),
          }),
        );
      },
    );

    expect(logs[0]).toContain(
      'actor=evaluador id=eval-1 email=eva@hospital.com',
    );
    expect(logs[1]).toContain('response={"readOnly":false}');
  });

  it('logs the error body and marks the request so the filter does not duplicate', async () => {
    const req: Record<string, unknown> = {
      method: 'POST',
      originalUrl: '/pruebas/aspirantes/respuestas',
      user: undefined,
      body: { idPregunta: 1 },
    };
    const context = createContext(req, { statusCode: 400 });
    const err = new BadRequestException(
      'Ya existe respuesta para esa pregunta',
    );

    await runWithRequestContext(
      { requestId: 'err-1', startedAt: Date.now() },
      async () => {
        await expect(
          lastValueFrom(
            interceptor.intercept(context, {
              handle: () => throwError(() => err),
            }),
          ),
        ).rejects.toBe(err);
      },
    );

    expect(warns[0]).toContain('[err-1] ERROR 400');
    expect(warns[0]).toContain('POST /pruebas/aspirantes/respuestas');
    expect(warns[0]).toContain('error=BadRequestException');
    expect(warns[0]).toContain('Ya existe respuesta para esa pregunta');
    expect(req[REQUEST_ERROR_LOGGED_KEY]).toBe(true);
  });

  it('skips health/docs noise', async () => {
    const context = createContext(
      { method: 'GET', originalUrl: '/api', body: {} },
      { statusCode: 200 },
    );
    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of('ok') }),
    );
    expect(logs).toEqual([]);
  });
});
