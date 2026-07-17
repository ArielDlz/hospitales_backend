import { defer, from, lastValueFrom } from 'rxjs';
import {
  getRequestId,
  runWithRequestContext,
} from './request-context';

/**
 * Nest-like bridge: Observable is created now; the async controller only runs
 * when something later subscribes (after ALS.run has already returned).
 */
function nestLikeHandle(
  controller: () => Promise<unknown>,
) {
  return defer(() => from(Promise.resolve(controller())));
}

describe('request-context ALS', () => {
  it('loses requestId when returning next.handle() from inside run (interceptor anti-pattern)', async () => {
    const ids: Array<string | undefined> = [];

    const observable = runWithRequestContext({ requestId: 'lost' }, () =>
      nestLikeHandle(async () => {
        await Promise.resolve();
        ids.push(getRequestId());
        return 'ok';
      }),
    );

    // Subscription happens after run() returned — classic interceptor bug.
    await lastValueFrom(observable);

    expect(ids).toEqual([undefined]);
  });

  it('keeps requestId across await when middleware runs next() inside ALS', async () => {
    const ids: Array<string | undefined> = [];

    await new Promise<void>((resolve, reject) => {
      runWithRequestContext({ requestId: 'kept' }, () => {
        // Express/Nest middleware style: continue the chain inside run().
        void (async () => {
          try {
            ids.push(getRequestId());
            await new Promise((r) => setTimeout(r, 5));
            ids.push(getRequestId());
            await lastValueFrom(
              nestLikeHandle(async () => {
                await Promise.resolve();
                ids.push(getRequestId());
                return 'ok';
              }),
            );
            resolve();
          } catch (err) {
            reject(err);
          }
        })();
      });
    });

    expect(ids).toEqual(['kept', 'kept', 'kept']);
  });

  it('getRequestId is undefined outside any context', () => {
    expect(getRequestId()).toBeUndefined();
  });
});
