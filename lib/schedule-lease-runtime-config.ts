import { createScheduleExecutionLeaseBoundary, type ScheduleLeaseAdapter, type ScheduleExecutionLease } from './schedule-execution-lease.ts';

const PROVIDER_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const HOLDER_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const DEFAULT_LEASE_MS = 60_000;
const MIN_LEASE_MS = 1_000;
const MAX_LEASE_MS = 15 * 60_000;

export interface ScheduleLeaseConfig {
  readonly provider: string;
  readonly holderId: string;
  readonly leaseMs: number;
  readonly renewIntervalMs: number;
}
export interface ScheduleLeaseRuntime {
  readonly configured: boolean;
  readonly provider: string | null;
  readonly lease: ScheduleExecutionLease | null;
  readonly renewIntervalMs: number | null;
}
type Env = Record<string, string | undefined>;
type ProviderFactory = (input: Readonly<{ provider: string }>) => Promise<ScheduleLeaseAdapter> | ScheduleLeaseAdapter;
type ProviderFactories = Record<string, ProviderFactory>;
type BoundaryFactory = typeof createScheduleExecutionLeaseBoundary;

const invalidConfig = (): Error => new Error('INVALID_SCHEDULE_LEASE_CONFIG');
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const parseInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const raw = text(value);
  if (!raw) return fallback;
  if (!/^[0-9]+$/.test(raw)) throw invalidConfig();
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw invalidConfig();
  return parsed;
};

export function readScheduleLeaseRuntimeConfig(env: Env = process.env): ScheduleLeaseConfig | null {
  if (!env || Array.isArray(env) || typeof env !== 'object') throw invalidConfig();
  const provider = text(env.HAFIZE_SCHEDULE_LEASE_PROVIDER);
  const holderId = text(env.HAFIZE_SCHEDULE_LEASE_HOLDER_ID);
  const leaseRaw = text(env.HAFIZE_SCHEDULE_LEASE_MS);
  const renewRaw = text(env.HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS);
  if (!provider && !holderId && !leaseRaw && !renewRaw) return null;
  if (!PROVIDER_PATTERN.test(provider) || !HOLDER_PATTERN.test(holderId)) throw invalidConfig();
  const leaseMs = parseInteger(leaseRaw, DEFAULT_LEASE_MS, MIN_LEASE_MS, MAX_LEASE_MS);
  const defaultRenew = Math.max(250, Math.floor(leaseMs / 2));
  const renewIntervalMs = parseInteger(renewRaw, defaultRenew, 100, Math.max(100, leaseMs - 100));
  if (renewIntervalMs >= leaseMs) throw invalidConfig();
  return Object.freeze({ provider, holderId, leaseMs, renewIntervalMs });
}

export async function createScheduleLeaseProviderRuntime(input: {
  env?: Env;
  providerFactories?: ProviderFactories;
  createBoundary?: BoundaryFactory;
} = {}): Promise<ScheduleLeaseRuntime> {
  const config = readScheduleLeaseRuntimeConfig(input.env);
  if (config == null) return Object.freeze({ configured: false, provider: null, lease: null, renewIntervalMs: null });
  const providerFactories = input.providerFactories ?? {};
  if (!providerFactories || Array.isArray(providerFactories) || typeof providerFactories !== 'object') {
    throw new Error('INVALID_SCHEDULE_LEASE_RUNTIME:providerFactories');
  }
  const createBoundary = input.createBoundary ?? createScheduleExecutionLeaseBoundary;
  if (typeof createBoundary !== 'function') throw new Error('INVALID_SCHEDULE_LEASE_RUNTIME:createBoundary');

  const factory = providerFactories[config.provider];
  if (typeof factory !== 'function') throw new Error('SCHEDULE_LEASE_PROVIDER_UNAVAILABLE');

  let adapter: ScheduleLeaseAdapter;
  try {
    adapter = await factory(Object.freeze({ provider: config.provider }));
  } catch {
    throw new Error('SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED');
  }

  let lease: { acquire: (...args: unknown[]) => unknown };
  try {
    lease = createBoundary({ adapter, holderId: config.holderId, leaseMs: config.leaseMs }) as typeof lease;
  } catch {
    throw new Error('SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED');
  }
  if (!lease || typeof lease.acquire !== 'function') throw new Error('SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED');

  return Object.freeze({ configured: true, provider: config.provider, lease, renewIntervalMs: config.renewIntervalMs });
}
