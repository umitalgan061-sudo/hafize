const MIN_LEASE_MS = 1_000;
const MAX_LEASE_MS = 15 * 60_000;
const MIN_PROVIDER_TIMEOUT_MS = 100;
const MAX_PROVIDER_TIMEOUT_MS = 5_000;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const ACQUIRE_STATUSES = new Set(['acquired', 'busy', 'completed']);
const RENEW_STATUSES = new Set(['renewed', 'stale', 'completed']);
const COMPLETE_STATUSES = new Set(['completed', 'already_completed', 'stale']);
const RELEASE_STATUSES = new Set(['released', 'stale', 'completed']);

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function cleanId(value, label) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!ID_PATTERN.test(text)) throw new Error(`INVALID_SCHEDULE_LEASE:${label}`);
  return text;
}

/**
 * @param {number | undefined} value
 * @returns {number}
 */
function cleanLeaseMs(value) {
  if (!Number.isInteger(value)) return 60_000;
  return Math.min(Math.max(value, MIN_LEASE_MS), MAX_LEASE_MS);
}

/**
 * @param {number | undefined} value
 * @param {number} leaseMs
 * @returns {number}
 */
function cleanProviderTimeoutMs(value, leaseMs) {
  const maxTimeout = Math.max(
    MIN_PROVIDER_TIMEOUT_MS,
    Math.min(MAX_PROVIDER_TIMEOUT_MS, leaseMs - MIN_PROVIDER_TIMEOUT_MS)
  );
  const fallback = Math.min(
    maxTimeout,
    Math.max(MIN_PROVIDER_TIMEOUT_MS, Math.floor(leaseMs / 4))
  );
  if (!Number.isInteger(value)) return fallback;
  return Math.min(Math.max(value, MIN_PROVIDER_TIMEOUT_MS), maxTimeout);
}

/**
 * @param {number | undefined} value
 * @returns {number}
 */
function cleanFence(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('INVALID_SCHEDULE_LEASE:fence');
  return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function cleanIso(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:${label}`);
  return date.toISOString();
}

/** @param {string} scheduleId */
function idempotencyKey(scheduleId) {
  return `schedule-execution:${scheduleId}`;
}

function providerFailure() {
  return new Error('SCHEDULE_LEASE_PROVIDER_FAILED');
}

/** @param {string} [label] */
function invalidProviderResponse(label = 'response') {
  return new Error(`SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:${label}`);
}

/**
 * @param {Function} method
 * @param {unknown} input
 * @param {number} timeoutMs
 */
async function callProvider(method, input, timeoutMs) {
  let timer = null;
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(providerFailure()), timeoutMs);
    });
    return await Promise.race([
      Promise.resolve().then(() => method(input)),
      timeout
    ]);
  } catch {
    throw providerFailure();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {Record<string, any> | null | undefined} result
 * @param {string} scheduleId
 */
function parseAcquire(result, scheduleId) {
  if (!result || Array.isArray(result) || typeof result !== 'object' || !ACQUIRE_STATUSES.has(result.status)) {
    throw invalidProviderResponse();
  }
  if (result.status === 'acquired') {
    return Object.freeze({
      status: 'acquired',
      fence: cleanFence(result.fence),
      expiresAt: cleanIso(result.expiresAt, 'expiresAt'),
      idempotencyKey: idempotencyKey(scheduleId)
    });
  }
  if (result.status === 'busy') {
    return Object.freeze({ status: 'busy', retryAt: cleanIso(result.retryAt, 'retryAt') });
  }
  return Object.freeze({ status: 'completed', idempotencyKey: idempotencyKey(scheduleId) });
}

/** @param {Record<string, any> | null | undefined} result */
function parseRenew(result) {
  if (!result || Array.isArray(result) || typeof result !== 'object' || !RENEW_STATUSES.has(result.status)) {
    throw invalidProviderResponse();
  }
  if (result.status === 'renewed') {
    return Object.freeze({ status: 'renewed', expiresAt: cleanIso(result.expiresAt, 'expiresAt') });
  }
  return Object.freeze({ status: result.status });
}

/**
 * @param {Record<string, any> | null | undefined} result
 * @param {string[]} statuses
 */
function parseTerminal(result, statuses) {
  if (!result || Array.isArray(result) || typeof result !== 'object' || !statuses.has(result.status)) {
    throw invalidProviderResponse();
  }
  return Object.freeze({ status: result.status });
}

/**
 * Kira sağlayıcısını zaman aşımı ve fence doğrulamasıyla sarar.
 *
 * @param {{ adapter?: any; holderId?: string; leaseMs?: number; providerTimeoutMs?: number }} [options]
 */
export function createScheduleExecutionLeaseBoundary({
  adapter,
  holderId,
  leaseMs = 60_000,
  providerTimeoutMs
} = {}) {
  if (
    typeof adapter?.acquire !== 'function' ||
    typeof adapter?.renew !== 'function' ||
    typeof adapter?.complete !== 'function' ||
    typeof adapter?.release !== 'function'
  ) throw new Error('INVALID_SCHEDULE_LEASE:adapter');

  const holder = cleanId(holderId, 'holderId');
  const ttlMs = cleanLeaseMs(leaseMs);
  const timeoutMs = cleanProviderTimeoutMs(providerTimeoutMs, ttlMs);

  /** @param {string} scheduleId */
  async function acquire(scheduleId) {
    const id = cleanId(scheduleId, 'scheduleId');
    const result = await callProvider(adapter.acquire.bind(adapter), {
      scheduleId: id,
      holderId: holder,
      leaseMs: ttlMs
    }, timeoutMs);
    return parseAcquire(result, id);
  }

  /** @param {{ scheduleId?: string; fence?: number }} [input] */
  async function renew({ scheduleId, fence } = {}) {
    const id = cleanId(scheduleId, 'scheduleId');
    const safeFence = cleanFence(fence);
    const result = await callProvider(adapter.renew.bind(adapter), {
      scheduleId: id,
      holderId: holder,
      fence: safeFence,
      leaseMs: ttlMs
    }, timeoutMs);
    return parseRenew(result);
  }

  /** @param {{ scheduleId?: string; fence?: number }} [input] */
  async function complete({ scheduleId, fence } = {}) {
    const id = cleanId(scheduleId, 'scheduleId');
    const safeFence = cleanFence(fence);
    const result = await callProvider(adapter.complete.bind(adapter), {
      scheduleId: id,
      holderId: holder,
      fence: safeFence,
      idempotencyKey: idempotencyKey(id)
    }, timeoutMs);
    return parseTerminal(result, COMPLETE_STATUSES);
  }

  /** @param {{ scheduleId?: string; fence?: number }} [input] */
  async function release({ scheduleId, fence } = {}) {
    const id = cleanId(scheduleId, 'scheduleId');
    const safeFence = cleanFence(fence);
    const result = await callProvider(adapter.release.bind(adapter), {
      scheduleId: id,
      holderId: holder,
      fence: safeFence
    }, timeoutMs);
    return parseTerminal(result, RELEASE_STATUSES);
  }

  return Object.freeze({
    holderId: holder,
    leaseMs: ttlMs,
    providerTimeoutMs: timeoutMs,
    acquire,
    renew,
    complete,
    release
  });
}
