import assert from 'node:assert/strict';
import { createRedisOAuthFlowStoreRuntime } from '../lib/redis-oauth-flow-store-runtime.mjs';

const env = { HAFIZE_OAUTH_REDIS_URL: 'redis://redis.example.test:6379/5' };
const flow = {
  state: 's'.repeat(43),
  verifier: 'v'.repeat(64),
  provider: 'google',
  redirectUri: 'https://hafize.example.test/oauth/google',
  scopes: ['openid', 'email']
};

let storedPayload = null;
let closeCalls = 0;
let evalCalls = 0;
const client = {
  isReady: false,
  isOpen: false,
  async connect() {
    this.isReady = true;
    this.isOpen = true;
  },
  async eval(script, { arguments: args }) {
    evalCalls += 1;
    if (script.includes('ZREMRANGEBYSCORE')) {
      storedPayload = args[2];
      return 9_999_999;
    }
    if (script.includes("redis.call('GET'")) {
      const value = storedPayload;
      storedPayload = null;
      return value;
    }
    throw new Error('unexpected script');
  },
  async close() {
    closeCalls += 1;
    this.isReady = false;
    this.isOpen = false;
  },
  destroy() {
    this.isReady = false;
    this.isOpen = false;
  }
};

const runtime = await createRedisOAuthFlowStoreRuntime({
  env,
  loadRedisModule: async () => ({ createClient: () => client }),
  storeOptions: { ttlMs: 30_000, maxFlows: 8, commandTimeoutMs: 1_000 }
});

assert.equal(runtime.configured, true);
const issued = await runtime.store.issue(flow);
assert.deepEqual(issued, { state: flow.state, expiresAt: 9_999_999 });
assert.equal(typeof storedPayload, 'string');
assert.equal(storedPayload.includes(flow.verifier), true);
assert.equal(storedPayload.includes(flow.state), false, 'raw state must not enter Redis payload');

const consumed = await runtime.store.consume(flow.state);
assert.equal(consumed.state, flow.state);
assert.equal(consumed.verifier, flow.verifier);
assert.equal(consumed.provider, 'google');
assert.deepEqual(consumed.scopes, flow.scopes);
assert.equal(storedPayload, null);
assert.equal(evalCalls, 2);

await runtime.close();
assert.equal(closeCalls, 1);
await assert.rejects(() => runtime.store.issue(flow), (error) => error?.code === 'OAUTH_FLOW_STORE_UNAVAILABLE');

console.log('Redis OAuth flow store runtime integration tests passed');
