import assert from 'node:assert/strict';
import { createRedisLeaseClient, readRedisLeaseClientConfig } from '../lib/redis-lease-client-factory.mjs';

assert.equal(readRedisLeaseClientConfig({}), null);
assert.throws(() => readRedisLeaseClientConfig({ HAFIZE_SCHEDULE_REDIS_URL: 'https://example.com' }), /INVALID_REDIS_LEASE_CLIENT_CONFIG/);
assert.throws(() => readRedisLeaseClientConfig({ HAFIZE_SCHEDULE_REDIS_URL: 'redis:///missing-host' }), /INVALID_REDIS_LEASE_CLIENT_CONFIG/);
assert.throws(() => readRedisLeaseClientConfig({ HAFIZE_SCHEDULE_REDIS_URL: 'redis://host/#secret' }), /INVALID_REDIS_LEASE_CLIENT_CONFIG/);

const secretUrl = 'rediss://hafize:super-secret@example.redis.local:6380/0';
const config = readRedisLeaseClientConfig({ HAFIZE_SCHEDULE_REDIS_URL: secretUrl });
assert.equal(config.url, secretUrl);
assert.equal(JSON.stringify(config), '{}');
assert.equal(Object.keys(config).includes('url'), false);

let createArgs = null;
let connectCalls = 0;
const readyClient = {
  isReady: false,
  isOpen: false,
  async connect() {
    connectCalls += 1;
    this.isOpen = true;
    this.isReady = true;
  },
  async eval() {},
  async quit() { this.isOpen = false; }
};
const runtime = await createRedisLeaseClient({
  env: { HAFIZE_SCHEDULE_REDIS_URL: secretUrl, REDIS_PASSWORD: 'must-not-pass-separately' },
  createClient(options) {
    createArgs = options;
    return readyClient;
  }
});
assert.equal(runtime.configured, true);
assert.equal(runtime.client, readyClient);
assert.equal(connectCalls, 1);
assert.deepEqual(createArgs, { url: secretUrl });
assert.equal('REDIS_PASSWORD' in createArgs, false);
assert.equal(Object.isFrozen(runtime), true);

const disabled = await createRedisLeaseClient({ env: {}, createClient() { throw new Error('must not call'); } });
assert.deepEqual(disabled, { configured: false, client: null });

await assert.rejects(() => createRedisLeaseClient({
  env: { HAFIZE_SCHEDULE_REDIS_URL: secretUrl }
}), /REDIS_LEASE_CLIENT_UNAVAILABLE/);

let quitCalls = 0;
await assert.rejects(() => createRedisLeaseClient({
  env: { HAFIZE_SCHEDULE_REDIS_URL: secretUrl },
  createClient() {
    return {
      isReady: false,
      isOpen: false,
      async connect() {
        this.isOpen = true;
        throw new Error(`connect failed ${secretUrl}`);
      },
      async eval() {},
      async quit() { quitCalls += 1; this.isOpen = false; }
    };
  }
}), (error) => {
  assert.equal(error.message, 'REDIS_LEASE_CLIENT_STARTUP_FAILED');
  assert.equal(error.message.includes('super-secret'), false);
  return true;
});
assert.equal(quitCalls, 1);

let disconnectCalls = 0;
await assert.rejects(() => createRedisLeaseClient({
  env: { HAFIZE_SCHEDULE_REDIS_URL: 'redis://localhost:6379' },
  createClient() {
    return {
      isReady: false,
      isOpen: true,
      async connect() {},
      async eval() {},
      disconnect() { disconnectCalls += 1; this.isOpen = false; }
    };
  }
}), /REDIS_LEASE_CLIENT_STARTUP_FAILED/);
assert.equal(disconnectCalls, 1);

console.log('redis lease client factory tests passed');
