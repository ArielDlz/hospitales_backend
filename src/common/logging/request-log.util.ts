import { HttpException, StreamableFile } from '@nestjs/common';
import { Request } from 'express';
import { RolUsuarioAdmin } from '../enums/rol-usuario-admin.enum';
import {
  isAdminPayload,
  isAspirantePayload,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

export const REQUEST_ERROR_LOGGED_KEY = '__requestLoggingErrorLogged';

export const REQUEST_ID_HEADER = 'x-request-id';

const REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/;
const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|hash|primer.?acceso|access.?token|refresh.?token|api.?key|firma|cvv|card/i;
const MAX_JSON_CHARS = 4000;
const MAX_STRING_CHARS = 500;
const MAX_ARRAY_ITEMS = 40;
const MAX_DEPTH = 6;

export type LoggedRequest = Request & {
  user?: JwtPayload;
  [REQUEST_ERROR_LOGGED_KEY]?: boolean;
};

export function resolveIncomingRequestId(
  req: Pick<Request, 'headers'>,
): string | undefined {
  const raw = req.headers[REQUEST_ID_HEADER] ?? req.headers['x-correlation-id'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === 'string' && REQUEST_ID_PATTERN.test(value.trim())) {
    return value.trim();
  }
  return undefined;
}

export function formatActor(
  user: JwtPayload | undefined,
  body?: unknown,
): string {
  if (!user) {
    const email = emailFromBody(body);
    return email ? `actor=anonymous email=${email}` : 'actor=anonymous';
  }
  if (isAspirantePayload(user)) {
    return [
      'actor=aspirante',
      `id=${user.sub}`,
      `email=${user.email ?? '(n/a)'}`,
      `nombre=${user.nombre}`,
      `slug=${user.slug}`,
      `registro=${user.registro}`,
      `flowOrderId=${user.evaluationFlowOrderId ?? '(n/a)'}`,
    ].join(' ');
  }
  if (isAdminPayload(user)) {
    const actor =
      user.rol === RolUsuarioAdmin.Evaluador ? 'evaluador' : 'administrador';
    return [
      `actor=${actor}`,
      `id=${user.sub}`,
      `email=${user.email ?? '(n/a)'}`,
      `rol=${user.rol}`,
    ].join(' ');
  }
  return 'actor=unknown';
}

export function describeHttpError(err: unknown): {
  status: number;
  name: string;
  message: string;
  response: unknown;
} {
  if (err instanceof HttpException) {
    return {
      status: err.getStatus(),
      name: err.constructor.name,
      message: err.message,
      response: err.getResponse(),
    };
  }
  if (err instanceof Error) {
    return {
      status: 500,
      name: err.constructor.name,
      message: err.message,
      response: err.stack ?? err.message,
    };
  }
  return {
    status: 500,
    name: 'Error',
    message: String(err),
    response: err,
  };
}

export function serializeForLog(value: unknown): string {
  if (value === undefined || value === null) {
    return '(empty)';
  }
  if (value instanceof StreamableFile) {
    return describeStreamableFile(value);
  }
  if (Buffer.isBuffer(value)) {
    return `[Buffer length=${value.length}]`;
  }
  if (typeof value === 'string') {
    return truncate(value, MAX_STRING_CHARS);
  }

  try {
    const json = JSON.stringify(sanitize(value, 0, new WeakSet()));
    if (json.length <= MAX_JSON_CHARS) {
      return json;
    }
    return `${json.slice(0, MAX_JSON_CHARS)}…(truncated, ${json.length} chars)`;
  } catch {
    return fallbackString(value);
  }
}

function fallbackString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return `${value}`;
  }
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }
  return '[Unserializable]';
}

function describeStreamableFile(value: StreamableFile): string {
  const headers = value.getHeaders();
  const type = headers.type ?? 'unknown';
  const length = headers.length;
  return length != null
    ? `[StreamableFile type=${type} length=${length}]`
    : `[StreamableFile type=${type}]`;
}

function emailFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }
  const email = (body as { email?: unknown }).email;
  return typeof email === 'string' && email.trim() ? email.trim() : undefined;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…(truncated, ${value.length} chars)`;
}

function sanitize(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'string') return truncate(value, MAX_STRING_CHARS);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') return fallbackString(value);
  if (Buffer.isBuffer(value)) return `[Buffer length=${value.length}]`;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof StreamableFile) {
    return describeStreamableFile(value);
  }
  if (depth >= MAX_DEPTH) return '[MaxDepth]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const sliced = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitize(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) {
      sliced.push(`…(${value.length - MAX_ARRAY_ITEMS} more)`);
    }
    return sliced;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    output[key] = SENSITIVE_KEY.test(key)
      ? '[redacted]'
      : sanitize(nested, depth + 1, seen);
  }
  return output;
}
