import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextStore = {
  requestId: string;
  startedAt?: number;
};

const requestContext = new AsyncLocalStorage<RequestContextStore>();

/**
 * Run `fn` with request context. Prefer RequestContextMiddleware for HTTP:
 * calling this around `return next.handle()` in an interceptor loses the store
 * before Nest subscribes to the Observable.
 */
export function runWithRequestContext<T>(
  store: RequestContextStore,
  fn: () => T,
): T {
  return requestContext.run(store, fn);
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function getRequestElapsedMs(): number | undefined {
  const startedAt = requestContext.getStore()?.startedAt;
  return typeof startedAt === 'number' ? Date.now() - startedAt : undefined;
}
