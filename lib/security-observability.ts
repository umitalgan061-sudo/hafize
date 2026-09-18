import { createHash, randomUUID } from 'node:crypto';
import type { SecurityEvent } from './runtime-contracts.ts';

const EVENT_PATTERN = /^[a-z][a-z0-9_.:-]{1,63}$/;
const MAX_ROUTE = 200;
const MAX_REQUEST_ID = 120;
const SECRET_WORDS = /authorization|cookie|token|secret|password|credential|api[-_]?key|private[-_]?key/i;

function clean(value: unknown, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : '';
}

function normalizeEvent(value: unknown): string {
  const event = clean(value, 64);
  if (!EVENT_PATTERN.test(event)) throw new Error('INVALID_SECURITY_EVENT_TYPE');
  return event;
}

function normalizeRoute(value: unknown): string {
  const raw = clean(value, MAX_ROUTE) || '/';
  try {
    return clean(new URL(raw, 'http://hafize.local').pathname, MAX_ROUTE) || '/';
  } catch {
    return clean(raw.split(/[?#]/, 1)[0] || '/', MAX_ROUTE) || '/';
  }
}

function metadata(value: unknown): Readonly<Record<string, string | number | boolean>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({});
  const output: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_WORDS.test(key)) continue;
    if (typeof item === 'string') output[key] = clean(item, MAX_ROUTE);
    else if (typeof item === 'number' && Number.isFinite(item)) output[key] = item;
    else if (typeof item === 'boolean') output[key] = item;
  }
  return Object.freeze(output);
}

function fingerprint(subject: unknown): string {
  return createHash('sha256').update(String(subject)).digest('hex').slice(0, 16);
}

export interface SecurityLoggerOptions {
  readonly sink?: (line: string) => void;
  readonly now?: () => number;
}

export function createSecurityEventLogger({
  sink = console.info,
  now = () => Date.now()
}: SecurityLoggerOptions = {}): Readonly<{
  record: (input?: {
    event?: unknown;
    requestId?: unknown;
    route?: unknown;
    method?: unknown;
    outcome?: unknown;
    metadata?: unknown;
  }) => SecurityEvent;
  classifyPrincipal: (subject: unknown) => string;
}> {
  if (typeof sink !== 'function' || typeof now !== 'function') throw new Error('INVALID_SECURITY_EVENT_LOGGER');

  function record(input: { event?: unknown; requestId?: unknown; route?: unknown; method?: unknown; outcome?: unknown; metadata?: unknown } = {}): SecurityEvent {
    const payload = Object.freeze({
      timestamp: new Date(now()).toISOString(),
      event: normalizeEvent(input.event),
      requestId: clean(input.requestId, MAX_REQUEST_ID) || randomUUID(),
      route: normalizeRoute(input.route),
      method: clean(input.method, 16).toUpperCase() || 'GET',
      outcome: clean(input.outcome, 32) || 'unknown',
      metadata: metadata(input.metadata)
    }) as SecurityEvent;
    sink('hafize.security ' + JSON.stringify(payload));
    return payload;
  }

  return Object.freeze({ record, classifyPrincipal: fingerprint });
}

export const SECURITY_OBSERVABILITY_LIMITS = Object.freeze({
  maxRouteLength: MAX_ROUTE,
  maxRequestIdLength: MAX_REQUEST_ID,
  fingerprintLength: 16
});
