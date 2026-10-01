const MIN_LEASE_MS = 1_000;
const MAX_LEASE_MS = 15 * 60_000;
const MIN_PROVIDER_TIMEOUT_MS = 100;
const MAX_PROVIDER_TIMEOUT_MS = 5_000;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const ACQUIRE_STATUSES = new Set(['acquired', 'busy', 'completed']);
const RENEW_STATUSES = new Set(['renewed', 'stale', 'completed']);
const COMPLETE_STATUSES = new Set(['completed', 'already_completed', 'stale']);
const RELEASE_STATUSES = new Set(['released', 'stale', 'completed']);

export interface ScheduleLeaseAdapter {
  acquire: (input: Record<string, unknown>) => Promise<unknown> | unknown;
  renew: (input: Record<string, unknown>) => Promise<unknown> | unknown;
  complete: (input: Record<string, unknown>) => Promise<unknown> | unknown;
  release: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}
export interface ScheduleExecutionLease {
  readonly holderId: string;
  readonly leaseMs: number;
  readonly providerTimeoutMs: number;
  readonly acquire: (scheduleId: string) => Promise<Readonly<Record<string, unknown>>>;
  readonly renew: (input: { scheduleId: string; fence: number }) => Promise<Readonly<Record<string, unknown>>>;
  readonly complete: (input: { scheduleId: string; fence: number }) => Promise<Readonly<Record<string, unknown>>>;
  readonly release: (input: { scheduleId: string; fence: number }) => Promise<Readonly<Record<string, unknown>>>;
}
const cleanId = (value: unknown, label: string): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!ID_PATTERN.test(text)) throw new Error('INVALID_SCHEDULE_LEASE:' + label);
  return text;
};
const cleanLeaseMs = (value: unknown): number => Number.isInteger(value) ? Math.min(Math.max(value as number, MIN_LEASE_MS), MAX_LEASE_MS) : 60_000;
const cleanProviderTimeoutMs = (value: unknown, leaseMs: number): number => {
  const maxTimeout = Math.max(MIN_PROVIDER_TIMEOUT_MS, Math.min(MAX_PROVIDER_TIMEOUT_MS, leaseMs - MIN_PROVIDER_TIMEOUT_MS));
  const fallback = Math.min(maxTimeout, Math.max(MIN_PROVIDER_TIMEOUT_MS, Math.floor(leaseMs / 4)));
  return Number.isInteger(value) ? Math.min(Math.max(value as number, MIN_PROVIDER_TIMEOUT_MS), maxTimeout) : fallback;
};
const cleanFence = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('INVALID_SCHEDULE_LEASE:fence');
  return value as number;
};
const cleanIso = (value: unknown, label: string): string => {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) throw new Error('SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:' + label);
  return date.toISOString();
};
const idempotencyKey = (scheduleId: string): string => 'schedule-execution:' + scheduleId;
const providerFailure = (): Error => new Error('SCHEDULE_LEASE_PROVIDER_FAILED');
const invalidProviderResponse = (label = 'response'): Error => new Error('SCHEDULE_LEASE_PROVIDER_INVALID_RESPONSE:' + label);

async function callProvider(method: (input: Record<string, unknown>) => Promise<unknown> | unknown, input: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(providerFailure()), timeoutMs); });
    return await Promise.race([Promise.resolve().then(() => method(input)), timeout]);
  } catch {
    throw providerFailure();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function parseAcquire(result: unknown, scheduleId: string): Readonly<Record<string, unknown>> {
  if (!result || Array.isArray(result) || typeof result !== 'object') throw invalidProviderResponse();
  const value = result as Record<string, unknown>;
  if (!ACQUIRE_STATUSES.has(String(value.status))) throw invalidProviderResponse();
  if (value.status === 'acquired') return Object.freeze({ status: 'acquired', fence: cleanFence(value.fence), expiresAt: cleanIso(value.expiresAt, 'expiresAt'), idempotencyKey: idempotencyKey(scheduleId) });
  if (value.status === 'busy') return Object.freeze({ status: 'busy', retryAt: cleanIso(value.retryAt, 'retryAt') });
  return Object.freeze({ status: 'completed', idempotencyKey: idempotencyKey(scheduleId) });
}
function parseRenew(result: unknown): Readonly<Record<string, unknown>> {
  if (!result || Array.isArray(result) || typeof result !== 'object') throw invalidProviderResponse();
  const value = result as Record<string, unknown>;
  if (!RENEW_STATUSES.has(String(value.status))) throw invalidProviderResponse();
  return value.status === 'renewed' ? Object.freeze({ status: 'renewed', expiresAt: cleanIso(value.expiresAt, 'expiresAt') }) : Object.freeze({ status: value.status });
}
function parseTerminal(result: unknown, statuses: Set<string>): Readonly<Record<string, unknown>> {
  if (!result || Array.isArray(result) || typeof result !== 'object') throw invalidProviderResponse();
  const value = result as Record<string, unknown>;
  if (!statuses.has(String(value.status))) throw invalidProviderResponse();
  return Object.freeze({ status: value.status });
}

export function createScheduleExecutionLeaseBoundary(input: {
  adapter?: ScheduleLeaseAdapter;
  holderId?: unknown;
  leaseMs?: unknown;
  providerTimeoutMs?: unknown;
} = {}): ScheduleExecutionLease {
  const adapter = input.adapter;
  if (!adapter || typeof adapter.acquire !== 'function' || typeof adapter.renew !== 'function' || typeof adapter.complete !== 'function' || typeof adapter.release !== 'function') {
    throw new Error('INVALID_SCHEDULE_LEASE:adapter');
  }
  const holder = cleanId(input.holderId, 'holderId');
  const ttlMs = cleanLeaseMs(input.leaseMs);
  const timeoutMs = cleanProviderTimeoutMs(input.providerTimeoutMs, ttlMs);
  const acquire = async (scheduleId: string) => parseAcquire(await callProvider(adapter.acquire.bind(adapter), { scheduleId: cleanId(scheduleId, 'scheduleId'), holderId: holder, leaseMs: ttlMs }, timeoutMs), scheduleId);
  const renew = async ({ scheduleId, fence }: { scheduleId: string; fence: number }) => {
    const id = cleanId(scheduleId, 'scheduleId');
    return parseRenew(await callProvider(adapter.renew.bind(adapter), { scheduleId: id, holderId: holder, fence: cleanFence(fence), leaseMs: ttlMs }, timeoutMs));
  };
  const complete = async ({ scheduleId, fence }: { scheduleId: string; fence: number }) => {
    const id = cleanId(scheduleId, 'scheduleId');
    return parseTerminal(await callProvider(adapter.complete.bind(adapter), { scheduleId: id, holderId: holder, fence: cleanFence(fence), idempotencyKey: idempotencyKey(id) }, timeoutMs), COMPLETE_STATUSES);
  };
  const release = async ({ scheduleId, fence }: { scheduleId: string; fence: number }) => {
    const id = cleanId(scheduleId, 'scheduleId');
    return parseTerminal(await callProvider(adapter.release.bind(adapter), { scheduleId: id, holderId: holder, fence: cleanFence(fence) }, timeoutMs), RELEASE_STATUSES);
  };
  return Object.freeze({ holderId: holder, leaseMs: ttlMs, providerTimeoutMs: timeoutMs, acquire, renew, complete, release });
}
