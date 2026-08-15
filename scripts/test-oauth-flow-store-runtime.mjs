import assert from 'node:assert/strict';
import { createOAuthFlowStoreRuntime, OAUTH_FLOW_STORE_ENV } from '../lib/oauth-flow-store-runtime.mjs';

const key = Buffer.alloc(32, 41).toString('base64');
const calls = [];
let closeCalls = 0;
const store = {
  async issue(input) { calls.push(['issue', input]); return { state: input.state }; },
  async consume(state) { calls.push(['consume', state]); return { state }; },
  async close() { closeCalls += 1; }
};
const env = {
  HAFIZE_OAUTH_FLOW_REDIS_URL: ' rediss://oauth-flow.example.test:6380/0 ',
  HAFIZE_OAUTH_TOKEN_KEY_B64: key
};
let config;
const runtime = createOAuthFlowStoreRuntime({
  env,
  ttlMs: 12_345,
  loadRedisModule: async () => ({}),
  createStore(input) { config = input; return store; }
});
assert.equal(config.redisUrl, 'rediss://oauth-flow.example.test:6380/0');
assert.equal(config.key.toString('base64'), key);
assert.equal(config.ttlMs, 12_345);
assert.equal(typeof config.loadRedisModule, 'function');
assert.deepEqual(runtime.status(), { configured: true, storage: 'encrypted-redis' });
assert.equal(JSON.stringify(runtime).includes(env.HAFIZE_OAUTH_FLOW_REDIS_URL.trim()), false);
assert.equal(JSON.stringify(runtime).includes(key), false);
await runtime.issue({ state: 'x'.repeat(43) });
await runtime.consume('x'.repeat(43));
assert.deepEqual(calls.map(([name]) => name), ['issue', 'consume']);
const closeA = runtime.close();
const closeB = runtime.close();
assert.strictEqual(closeA, closeB);
await closeA;
assert.equal(closeCalls, 1);
for (const bad of [{}, { HAFIZE_OAUTH_FLOW_REDIS_URL: env.HAFIZE_OAUTH_FLOW_REDIS_URL }, { HAFIZE_OAUTH_FLOW_REDIS_URL: env.HAFIZE_OAUTH_FLOW_REDIS_URL, HAFIZE_OAUTH_TOKEN_KEY_B64: 'bad' }]) {
  assert.throws(() => createOAuthFlowStoreRuntime({ env: bad, createStore: () => store }), /INVALID_OAUTH_FLOW_STORE_RUNTIME/);
}
assert.deepEqual(OAUTH_FLOW_STORE_ENV, { redisUrl: 'HAFIZE_OAUTH_FLOW_REDIS_URL', key: 'HAFIZE_OAUTH_TOKEN_KEY_B64' });
console.log('OAuth flow store runtime tests passed');
