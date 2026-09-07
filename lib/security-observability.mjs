import { createHash, randomUUID } from 'node:crypto';

const EVENT_PATTERN = /^[a-z][a-z0-9_.:-]{1,63}$/;
const MAX_EVENT = 1_024;
const MAX_ROUTE = 200;
const MAX_REQUEST_ID = 120;
const SECRET_WORDS = /authorization|cookie|token|secret|password|credential|api[-_]?key|private[-_]?key/i;

function clean(value, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : '';
}

function normalizeEventType(value) {
  const event = clean(value, 64);
  if (!EVENT_PATTERN.test(event)) throw new Error('INVALID_SECURITY_EVENT_TYPE');
  return event;
}

function normalizeRequestId(value) {
  const requestId = clean(value, MAX_REQUEST_ID);
  return requestId || randomUUID();
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return Object.freeze({});
  const result = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_WORDS.test(key)) continue;
    if (typeof value === 'string') result[key] = clean(value, MAX_ROUTE);
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    else if (typeof value === 'boolean') result[key] = value;
  }
  return Object.freeze(result);
}

function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function createSecurityEventLogger({ sink = console.info, now = () => Date.now() } = {}) {
  if (typeof sink !== 'function') throw new Error('INVALID_SECURITY_EVENT_SINK');
  if (typeof now !== 'function') throw new Error('INVALID_SECURITY_EVENT_CLOCK');

  function record({ event, requestId, route, method, outcome, metadata } = {}) {
    const type = normalizeEventType(event);
    const safeRequestId = normalizeRequestId(requestId);
    const safeRoute = clean(route, MAX_ROUTE) || '/';
    const safeMethod = clean(method, 16).toUpperCase() || 'GET';
    const safeOutcome = clean(outcome, 32) || 'unknown';
    const payload = Object.freeze({
      timestamp: new Date(now()).toISOString(),
      event: type,
      requestId: safeRequestId,
      route: safeRoute,
      method: safeMethod,
      outcome: safeOutcome,
      metadata: sanitizeMetadata(metadata)
    });
    sink(`hafize.security ${JSON.stringify(payload)}`);
    return payload;
  }

  function classifyPrincipal(subject) {
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
