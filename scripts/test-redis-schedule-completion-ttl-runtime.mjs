import assert from 'node:assert/strict';
import { createRedisScheduleLeaseRuntime } from '../lib/redis-schedule-lease-runtime.mjs';

const completionTtlMs = 3 * 24 * 60 * 60_000;
let adapterInput = null;
const client = { isOpen: true, async quit() { this.isOpen = false; } };
const runtime = await createRedisScheduleLeaseRuntime({
  env: {
    HAFIZE_SCHEDULE_LEASE_PROVIDER: 'redis',
    HAFIZE_SCHEDULE_LEASE_HOLDER_ID: 'worker-runtime',
    HAFIZE_SCHEDULE_LEASE_COMPLETION_TTL_MS: String(completionTtlMs),
    HAFIZE_REDIS_URL: 'redis://127.0.0.1:6379'
  },
  async loadRedisModule() { return { createClient() {} }; },
  async createClientRuntime() { return { configured: true, client }; },
  createAdapter(input) {
    adapterInput = input;
    return {
      async acquire() { return { status: 'busy', retryAt: '2026-08-18T04:00:01.000Z' }; },
      async renew() { return { status: 'stale' }; },
      async complete() { return { status: 'stale' }; },
      async release() { return { status: 'stale' }; }
    };
  },
  async createProviderRuntime({ providerFactories }) {
    const adapter = await providerFactories.redis({ completionTtlMs });
    assert.ok(adapter);
    return {
      configured: true,
      provider: 'redis',
      lease: { async acquire() { return { ok: false, error: 'SCHEDULE_LEASE_BUSY' }; } },
      renewIntervalMs: 30_000,
      completionTtlMs
    };
  }
});
assert.equal(adapterInput.redis, client);
assert.equal(adapterInput.completionTtlMs, completionTtlMs);
assert.equal(runtime.completionTtlMs, completionTtlMs);
await runtime.close();
assert.equal(client.isOpen, false);
console.log('redis schedule completion ttl runtime propagation ok');
