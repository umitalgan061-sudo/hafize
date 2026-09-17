import { createHash, randomUUID } from 'node:crypto';

const EVENT_PATTERN = /^[a-z][a-z0-9_.:-]{1,63}$/;
const MAX_EVENT = 1_024;
const MAX_ROUTE = 200;
const MAX_REQUEST_ID = 120;
const SECRET_WORDS = /authorization|cookie|token|secret|password|credential|api[-_]?key|private[-_]?key/i;

type Primitive = string | number | boolean;

export interface SecurityEventInput {
  readonly event?: unknown;
  readonly requestId?: unknown;
  readonly route?: unknown;
  readonly method?: unknown;
  readonly outcome?: unknown;
  readonly metadata?: unknown;
}

export interface SecurityEventPayload {
  readonly timestamp: string;
  readonly event: string;
  readonly requestId: string;
  readonly route: string;
  readonly method: string;
  readonly outcome: string;
  readonly metadata: Readonly<Record<string, Primitive>>;
}

export interface SecurityEventLoggerOptions {
  readonly sink?: (line: string) => void;
  readonly now?: () => number;
}

export interface SecurityEventLogger {
  readonly record: (event: SecurityEventInput) => SecurityEventPayload;
  readonly classifyPrincipal: (subject: unknown) => string;
}

function clean(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : '';
}

function normalizeEventType(value: unknown): string {
  const event = clean(value, 64);
  if (!EVENT_PATTERN.test(event)) throw new Error('INVALID_SECURITY_EVENT_TYPE');
  return event;
}

function normalizeRequestId(value: unknown): string {
  return clean(value, MAX_REQUEST_ID) || randomUUID();
}

function normalizeRoute(value: unknown): string {
  const raw = clean(value, MAX_ROUTE) || '/';
  try {
    const parsed = new URL(raw, 'http://hafize.local');
    return clean(parsed.pathname, MAX_ROUTE) || '/';
  } catch {
    const path = raw.split(/[?#]/, 1)[0];
    return clean(path, MAX_ROUTE) || '/';
  }
}

function sanitizeMetadata(metadata: unknown): Readonly<Record<string, Primitive>> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return Object.freeze({});
  const result: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_WORDS.test(key)) continue;
    if (typeof value === 'string') result[key] = clean(value, MAX_ROUTE);
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    else if (typeof value === 'boolean') result[key] = value;
  }
  return Object.freeze(result);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function createSecurityEventLogger(options: SecurityEventLoggerOptions = {}): SecurityEventLogger {
  const sink = options.sink ?? console.info;
  const now = options.now ?? (() => Date.now());
  if (typeof sink !== 'function') throw new Error('INVALID_SECURITY_EVENT_SINK');
  if (typeof now !== 'function') throw new Error('INVALID_SECURITY_EVENT_CLOCK');

  function record(input: SecurityEventInput = {}): SecurityEventPayload {
    const payload: SecurityEventPayload = Object.freeze({
      timestamp: new Date(now()).toISOString(),
      event: normalizeEventType(input.event),
      requestId: normalizeRequestId(input.requestId),
      route: normalizeRoute(input.route),
      method: clean(input.method, 16).toUpperCase() || 'GET',
      outcome: clean(input.outcome, 32) || 'unknown',
      metadata: sanitizeMetadata(input.metadata)
    });
    sink(`hafize.security ${JSON.stringify(payload)}`);
    return payload;
  }

  function classifyPrincipal(subject: unknown): string {
    const value = clean(subject, 200);
    return value ? fingerprint(value) : '';
  }

  return Object.freeze({ record, classifyPrincipal });
}

export const SECURITY_OBSERVABILITY_LIMITS = Object.freeze({
  maxEventLength: MAX_EVENT,
  maxRouteLength: MAX_ROUTE,
  maxRequestIdLength: MAX_REQUEST_ID,
  fingerprintLength: 16
});
