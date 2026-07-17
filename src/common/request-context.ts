import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextStore = {
  requestId: string;
};

const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(
  store: RequestContextStore,
  fn: () => T,
): T {
  return requestContext.run(store, fn);
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
