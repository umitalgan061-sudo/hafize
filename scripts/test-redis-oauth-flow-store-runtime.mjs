import assert from 'node:assert/strict';
import {
  createRedisOAuthFlowStoreRuntime,
  OAUTH_REDIS_RUNTIME_ENV,
  OAUTH_REDIS_RUNTIME_LIMITS,
  readOAuthRedisRuntimeConfig
} from '../lib/redis-oauth-flow-store-runtime.mjs';

const REDIS_URL = 'rediss://oauth-user:super-secret@redis.example.test:6380/4';

function makeClient({ connect = async function () { this.isReady = true; this.isOpen = true; } } = {}) {
  return {
    isReady: false,
    isOpen: false,
    connect,
    async eval() { return null; },
    destroyCalls: 0,
    destroy() {
      this.destroyCalls += 1;
      this.isReady = false;
      this.isOpen = false;
    }
  };
}

function makeStoreFactory(state = {}) {
  return (options) => {
    state.options = options;
    let closePromise = null;
    const store = {
      async issue() {},
      async consume() {},
      close() {
        if (closePromise) return closePromise;
        state.closeCalls = (state.closeCalls || 0) + 1;
        closePromise = state.closeReject
          ? Promise.reject(new Error('provider detail must stay private'))
          : Promise.resolve();
        return closePromise;
      }
    };
    state.store = store;
    return store;
  };
}

{
  let loads = 0;
  const runtime = await createRedisOAuthFlowStoreRuntime({
    env: {},
    loadRedisModule: async () => { loads += 1; return {}; }
  });
  assert.equal(runtime.configured, false);
  assert.equal(runtime.store, null);
  assert.equal(loads, 0, 'disabled runtime must not load Redis');
  await runtime.close();
}

{
  const config = readOAuthRedisRuntimeConfig({ [OAUTH_REDIS_RUNTIME_ENV]: REDIS_URL });
  assert.equal(config.url, REDIS_URL);
  assert.deepEqual(Object.keys(config), [], 'Redis URL must stay non-enumerable');
  assert.equal(JSON.stringify(config), '{}');
  assert.equal(JSON.stringify(config).includes('super-secret'), false);
}

for (const value of [
  'http://redis.example.test',
  'redis://',
  'redis://redis.example.test/0#fragment',
  'redis://redis.example.test/0\nINJECT',
  `redis://${'a'.repeat(4097)}.example.test`
]) {
  assert.throws(
    () => readOAuthRedisRuntimeConfig({ [OAUTH_REDIS_RUNTIME_ENV]: value }),
    (error) => error?.message === 'INVALID_OAUTH_REDIS_RUNTIME_CONFIG' && !error.message.includes(value)
  );
}
assert.throws(() => readOAuthRedisRuntimeConfig([]), /INVALID_OAUTH_REDIS_RUNTIME_CONFIG/);

{
  const client = makeClient();
  const state = {};
  let createClientOptions;
  const runtime = await createRedisOAuthFlowStoreRuntime({
    env: { [OAUTH_REDIS_RUNTIME_ENV]: REDIS_URL },
    loadRedisModule: async () => ({
      createClient(options) {
        createClientOptions = options;
        return client;
      }
    }),
    createStore: makeStoreFactory(state),
    storeOptions: { ttlMs: 7_000, maxFlows: 9, commandTimeoutMs: 1_500 }
  });
  assert.equal(runtime.configured, true);
  assert.strictEqual(runtime.store, state.store);
  assert.equal(createClientOptions.url, REDIS_URL);
  assert.strictEqual(state.options.client, client);
  assert.equal(state.options.ttlMs, 7_000);
  assert.equal(state.options.maxFlows, 9);
  assert.equal(state.options.commandTimeoutMs, 1_500);
  assert.equal(JSON.stringify(runtime).includes('super-secret'), false);

  const closeA = runtime.close();
  const closeB = runtime.close();
  assert.strictEqual(closeA, closeB, 'runtime close must be idempotent');
  await closeA;
  assert.equal(state.closeCalls, 1);
}

{
  let deadline;
  const client = makeClient({ connect() { return new Promise(() => {}); } });
  const pending = createRedisOAuthFlowStoreRuntime({
    env: { [OAUTH_REDIS_RUNTIME_ENV]: REDIS_URL },
    loadRedisModule: async () => ({ createClient: () => client }),
    createStore: makeStoreFactory(),
    setTimer(callback, ms) {
      assert.equal(ms, OAUTH_REDIS_RUNTIME_LIMITS.startupTimeoutMs);
      deadline = callback;
      return 1;
    },
    clearTimer() {}
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(typeof deadline, 'function');
  deadline();
  await assert.rejects(pending, (error) => error?.message === 'OAUTH_REDIS_RUNTIME_STARTUP_FAILED');
  assert.equal(client.destroyCalls, 1, 'hung startup must destroy the client');
}

for (const scenario of ['module', 'shape', 'connect', 'ready', 'timer-arm', 'timer-clear', 'store']) {
  const client = makeClient();
  const options = {
    env: { [OAUTH_REDIS_RUNTIME_ENV]: REDIS_URL },
    loadRedisModule: async () => ({ createClient: () => client }),
    createStore: makeStoreFactory()
  };
  if (scenario === 'module') options.loadRedisModule = async () => { throw new Error(`secret ${REDIS_URL}`); };
  if (scenario === 'shape') options.loadRedisModule = async () => ({ createClient: () => ({ connect() {} }) });
  if (scenario === 'connect') client.connect = async () => { throw new Error(`socket ${REDIS_URL}`); };
  if (scenario === 'ready') client.connect = async () => { client.isOpen = true; client.isReady = false; };
  if (scenario === 'timer-arm') options.setTimer = () => { throw new Error('timer unavailable'); };
  if (scenario === 'timer-clear') options.clearTimer = () => { throw new Error('timer cleanup failed'); };
  if (scenario === 'store') options.createStore = () => ({ issue() {}, consume() {} });

  await assert.rejects(
    () => createRedisOAuthFlowStoreRuntime(options),
    (error) => error?.message === 'OAUTH_REDIS_RUNTIME_STARTUP_FAILED'
      && !error.message.includes('super-secret')
      && !error.message.includes('socket')
  );
  if (!['module', 'shape'].includes(scenario)) assert.equal(client.destroyCalls, 1, `${scenario} must destroy client`);
}

{
  const client = makeClient();
  const state = { closeReject: true };
  const runtime = await createRedisOAuthFlowStoreRuntime({
    env: { [OAUTH_REDIS_RUNTIME_ENV]: REDIS_URL },
    loadRedisModule: async () => ({ createClient: () => client }),
    createStore: makeStoreFactory(state)
  });
  await assert.rejects(
    () => runtime.close(),
    (error) => error?.message === 'OAUTH_REDIS_RUNTIME_CLOSE_FAILED'
      && !error.message.includes('provider detail')
  );
  assert.equal(state.closeCalls, 1);
}

for (const invalid of [
  { loadRedisModule: null },
  { createStore: null },
  { storeOptions: [] },
  { setTimer: null },
  { clearTimer: null }
]) {
  await assert.rejects(
    () => createRedisOAuthFlowStoreRuntime({ env: { [OAUTH_REDIS_RUNTIME_ENV]: REDIS_URL }, ...invalid }),
    /INVALID_OAUTH_REDIS_RUNTIME/
  );
}

console.log('Redis OAuth flow store runtime tests passed');
