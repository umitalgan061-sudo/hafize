import { createHash, randomUUID } from 'node:crypto';

const EVENT_PATTERN = /^[a-z][a-z0-9_.:-]{1,63}$/;
const MAX_EVENT = 1_024;
const MAX_ROUTE = 200;
const MAX_REQUEST_ID = 120;
const SECRET_WORDS = /authorization|cookie|token|secret|password|credential|api[-_]?key|private[-_]?key/i;

/**
 * @param {unknown} value
 * @param {number} max
 * @returns {string}
 */
function clean(value, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, max) : '';
}

/** @param {unknown} value */
function normalizeEventType(value) {
  const event = clean(value, 64);
  if (!EVENT_PATTERN.test(event)) throw new Error('INVALID_SECURITY_EVENT_TYPE');
  return event;
}

/** @param {unknown} value */
function normalizeRequestId(value) {
  const requestId = clean(value, MAX_REQUEST_ID);
  return requestId || randomUUID();
}

/** @param {unknown} value */
function normalizeRoute(value) {
  const raw = clean(value, MAX_ROUTE) || '/';
  try {
    const parsed = new URL(raw, 'http://hafize.local');
    return clean(parsed.pathname, MAX_ROUTE) || '/';
  } catch {
    const path = raw.split(/[?#]/, 1)[0];
    return clean(path, MAX_ROUTE) || '/';
  }
}

/**
 * Secret adı taşıyan anahtarları düşürür ve yalnızca sade değerleri geçirir.
 *
 * @param {unknown} metadata
 * @returns {Readonly<Record<string, string | number | boolean>>}
 */
function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return Object.freeze({});
  /** @type {Record<string, string | number | boolean>} */
  const result = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_WORDS.test(key)) continue;
    if (typeof value === 'string') result[key] = clean(value, MAX_ROUTE);
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
    else if (typeof value === 'boolean') result[key] = value;
  }
  return Object.freeze(result);
}

/** @param {unknown} value */
function fingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

/**
 * Güvenlik olaylarını secret sızdırmadan tek satırlık JSON olarak yazar.
 *
 * @param {{ sink?: (line: string) => void; now?: () => number }} [options]
 */
export function createSecurityEventLogger({ sink = console.info, now = () => Date.now() } = {}) {
  if (typeof sink !== 'function') throw new Error('INVALID_SECURITY_EVENT_SINK');
  if (typeof now !== 'function') throw new Error('INVALID_SECURITY_EVENT_CLOCK');

  /**
   * @param {{ event?: string; requestId?: string; route?: string; method?: string; outcome?: string; metadata?: unknown }} [input]
   */
  function record({ event, requestId, route, method, outcome, metadata } = {}) {
    const type = normalizeEventType(event);
    const safeRequestId = normalizeRequestId(requestId);
    const safeRoute = normalizeRoute(route);
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

  /**
   * Özneyi geri döndürülemez bir parmak izine indirger.
   *
   * @param {unknown} subject
   * @returns {string}
   */
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
