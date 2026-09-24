const MIN_LEASE_MS = 1_000;
const MAX_LEASE_MS = 15 * 60_000;
const MIN_PROVIDER_TIMEOUT_MS = 100;
const MAX_PROVIDER_TIMEOUT_MS = 5_000;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const ACQUIRE_STATUSES = new Set(['acquired', 'busy', 'completed']);
const RENEW_STATUSES = new Set(['renewed', 'stale', 'completed']);
const COMPLETE_STATUSES = new Set(['completed', 'already_completed', 'stale']);
const RELEASE_STATUSES = new Set(['released', 'stale', 'completed']);

function cleanId(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!ID_PATTERN.test(text)) throw new Error(`INVALID_SCHEDULE_LEASE:${label}`);
  return text;
}

function cleanLeaseMs(value: number | undefined): number {
  if (!Number.isInteger(value)) return 60_000;
  return Math.min(Math.max(value, MIN_LEASE_MS), MAX_LEASE_MS);
}

function cleanProviderTimeoutMs(value: number | undefined, leaseMs: number): number {
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

function cleanFence(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('INVALID_SCHEDULE_LEASE:fence');
  return value;
}

function cleanIso(value: string | number | Date, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:${label}`);
  return date.toISOString();
}

function idempotencyKey(scheduleId: string) {
  return `schedule-execution:${scheduleId}`;
}

function providerFailure() {
  return new Error('SCHEDULE_LEASE_PROVIDER_FAILED');
}

function invalidProviderResponse(label: string = 'response') {
  return new Error(`SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:${label}`);
}

async function callProvider(method: Function, input: unknown, timeoutMs: number) {
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

function parseAcquire(result: Record<string, any> | null | undefined, scheduleId: string) {
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

function parseRenew(result: Record<string, any> | null | undefined) {
  if (!result || Array.isArray(result) || typeof result !== 'object' || !RENEW_STATUSES.has(result.status)) {
    throw invalidProviderResponse();
  }
  if (result.status === 'renewed') {
    return Object.freeze({ status: 'renewed', expiresAt: cleanIso(result.expiresAt, 'expiresAt') });
  }
  return Object.freeze({ status: result.status });
}

function parseTerminal(result: Record<string, any> | null | undefined, statuses: ReadonlySet<string>) {
  if (!result || Array.isArray(result) || typeof result !== 'object' || !statuses.has(result.status)) {
    throw invalidProviderResponse();
  }
  return Object.freeze({ status: result.status });
}

/**
 * Kira sağlayıcısını zaman aşımı ve fence doğrulamasıyla sarar.
 */
export function createScheduleExecutionLeaseBoundary({ adapter, holderId, leaseMs = 60_000, providerTimeoutMs }: { adapter?: any; holderId?: string; leaseMs?: number; providerTimeoutMs?: number } = {}) {
  if (
    typeof adapter?.acquire !== 'function' ||
    typeof adapter?.renew !== 'function' ||
    typeof adapter?.complete !== 'function' ||
    typeof adapter?.release !== 'function'
  ) throw new Error('INVALID_SCHEDULE_LEASE:adapter');

  const holder = cleanId(holderId, 'holderId');
  const ttlMs = cleanLeaseMs(leaseMs);
  const timeoutMs = cleanProviderTimeoutMs(providerTimeoutMs, ttlMs);

  async function acquire(scheduleId: string) {
    const id = cleanId(scheduleId, 'scheduleId');
    const result = await callProvider(adapter.acquire.bind(adapter), {
      scheduleId: id,
      holderId: holder,
      leaseMs: ttlMs
    }, timeoutMs);
    return parseAcquire(result, id);
  }

  async function renew({ scheduleId, fence }: { scheduleId?: string; fence?: number } = {}) {
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

  async function complete({ scheduleId, fence }: { scheduleId?: string; fence?: number } = {}) {
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

  async function release({ scheduleId, fence }: { scheduleId?: string; fence?: number } = {}) {
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
