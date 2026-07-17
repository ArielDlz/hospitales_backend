import { RequestContextMiddleware } from './request-context.middleware';
import { getRequestId } from '../request-context';

describe('RequestContextMiddleware', () => {
  it('exposes requestId to async work started via next()', async () => {
    const middleware = new RequestContextMiddleware();
    const seen: Array<string | undefined> = [];

    await new Promise<void>((resolve, reject) => {
      middleware.use({} as never, {} as never, () => {
        void (async () => {
          try {
            seen.push(getRequestId());
            await Promise.resolve();
            seen.push(getRequestId());
            await new Promise((r) => setTimeout(r, 5));
            seen.push(getRequestId());
            resolve();
          } catch (err) {
            reject(err);
          }
        })();
      });
    });

    expect(seen).toHaveLength(3);
    expect(seen[0]).toEqual(expect.any(String));
    expect(seen[0]).toHaveLength(8);
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).toBe(seen[0]);
  });
});
