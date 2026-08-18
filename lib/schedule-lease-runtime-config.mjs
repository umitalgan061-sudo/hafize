import { createScheduleExecutionLeaseBoundary } from './schedule-execution-lease.mjs';

const PROVIDER_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const HOLDER_PATTERN = /^[A-Za-z0-9._:-]{1,200}$/;
const DEFAULT_LEASE_MS = 60_000;
const MIN_LEASE_MS = 1_000;
const MAX_LEASE_MS = 15 * 60_000;
const DEFAULT_COMPLETION_TTL_MS = 7 * 24 * 60 * 60_000;
const MIN_COMPLETION_TTL_MS = 60 * 60_000;
const MAX_COMPLETION_TTL_MS = 30 * 24 * 60 * 60_000;

function invalidConfig() {
  return new Error('INVALID_SCHEDULE_LEASE_CONFIG');
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseInteger(value, fallback, min, max) {
  const raw = text(value);
  if (!raw) return fallback;
  if (!/^[0-9]+$/.test(raw)) throw invalidConfig();
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw invalidConfig();
  return parsed;
}

export function readScheduleLeaseRuntimeConfig(env = process.env) {
  if (!env || Array.isArray(env) || typeof env !== 'object') throw invalidConfig();

  const provider = text(env.HAFIZE_SCHEDULE_LEASE_PROVIDER);
  const holderId = text(env.HAFIZE_SCHEDULE_LEASE_HOLDER_ID);
  const leaseRaw = text(env.HAFIZE_SCHEDULE_LEASE_MS);
  const renewRaw = text(env.HAFIZE_SCHEDULE_LEASE_RENEW_INTERVAL_MS);
  const completionTtlRaw = text(env.HAFIZE_SCHEDULE_LEASE_COMPLETION_TTL_MS);
  const anyConfigured = Boolean(provider || holderId || leaseRaw || renewRaw || completionTtlRaw);
  if (!anyConfigured) return null;

  if (!PROVIDER_PATTERN.test(provider) || !HOLDER_PATTERN.test(holderId)) throw invalidConfig();

  const leaseMs = parseInteger(leaseRaw, DEFAULT_LEASE_MS, MIN_LEASE_MS, MAX_LEASE_MS);
  const defaultRenew = Math.max(250, Math.floor(leaseMs / 2));
  const renewIntervalMs = parseInteger(renewRaw, defaultRenew, 100, Math.max(100, leaseMs - 100));
  if (renewIntervalMs >= leaseMs) throw invalidConfig();
  const completionTtlMs = parseInteger(
    completionTtlRaw,
    DEFAULT_COMPLETION_TTL_MS,
    MIN_COMPLETION_TTL_MS,
    MAX_COMPLETION_TTL_MS
  );

  return Object.freeze({ provider, holderId, leaseMs, renewIntervalMs, completionTtlMs });
}

export async function createScheduleLeaseProviderRuntime({
  env = process.env,
  providerFactories = {},
  createBoundary = createScheduleExecutionLeaseBoundary
} = {}) {
  const config = readScheduleLeaseRuntimeConfig(env);
  if (config == null) {
    return Object.freeze({ configured: false, provider: null, lease: null, renewIntervalMs: null });
  }
  if (!providerFactories || Array.isArray(providerFactories) || typeof providerFactories !== 'object') {
    throw new Error('INVALID_SCHEDULE_LEASE_RUNTIME:providerFactories');
  }
  if (typeof createBoundary !== 'function') throw new Error('INVALID_SCHEDULE_LEASE_RUNTIME:createBoundary');

  const factory = providerFactories[config.provider];
  if (typeof factory !== 'function') throw new Error('SCHEDULE_LEASE_PROVIDER_UNAVAILABLE');

  let adapter;
  try {
    adapter = await factory(Object.freeze({
      provider: config.provider,
      completionTtlMs: config.completionTtlMs
    }));
  } catch {
    throw new Error('SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED');
  }

  let lease;
  try {
    lease = createBoundary({ adapter, holderId: config.holderId, leaseMs: config.leaseMs });
  } catch {
    throw new Error('SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED');
  }
  if (!lease || typeof lease.acquire !== 'function') throw new Error('SCHEDULE_LEASE_RUNTIME_STARTUP_FAILED');

  return Object.freeze({
    configured: true,
    provider: config.provider,
    lease,
    renewIntervalMs: config.renewIntervalMs,
    completionTtlMs: config.completionTtlMs
  });
}

export const SCHEDULE_LEASE_COMPLETION_TTL_LIMITS = Object.freeze({
  defaultMs: DEFAULT_COMPLETION_TTL_MS,
  minMs: MIN_COMPLETION_TTL_MS,
  maxMs: MAX_COMPLETION_TTL_MS
});
