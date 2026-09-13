import { RequestContextMiddleware } from './request-context.middleware';
import { getRequestElapsedMs, getRequestId } from '../request-context';

function mockRes() {
  return { setHeader: jest.fn() };
}

function mockReq(headers: Record<string, string> = {}) {
  return { headers };
}

describe('RequestContextMiddleware', () => {
  it('exposes requestId to async work started via next()', async () => {
    const middleware = new RequestContextMiddleware();
    const seen: Array<string | undefined> = [];
    const res = mockRes();

    await new Promise<void>((resolve, reject) => {
      middleware.use(mockReq() as never, res as never, () => {
        void (async () => {
          try {
            seen.push(getRequestId());
            await Promise.resolve();
            seen.push(getRequestId());
            await new Promise((r) => setTimeout(r, 5));
            seen.push(getRequestId());
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        })();
      });
    });

    expect(seen).toHaveLength(3);
    expect(seen[0]).toEqual(expect.any(String));
    expect(seen[0]).toHaveLength(8);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBe(seen[0]);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', seen[0]);
  });

  it('honors an incoming X-Request-Id and records startedAt', async () => {
    const middleware = new RequestContextMiddleware();
    const res = mockRes();
    let requestId: string | undefined;
    let elapsed: number | undefined;

    await new Promise<void>((resolve) => {
      middleware.use(
        mockReq({ 'x-request-id': 'client-abc' }) as never,
        res as never,
        () => {
          requestId = getRequestId();
          elapsed = getRequestElapsedMs();
          resolve();
        },
      );
    });

    expect(requestId).toBe('client-abc');
    expect(elapsed).toEqual(expect.any(Number));
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'client-abc');
  });
});
