import { createOAuthFlowRedisStore } from './oauth-flow-redis-store.mjs';

const REDIS_ENV = 'HAFIZE_OAUTH_FLOW_REDIS_URL';
const KEY_ENV = 'HAFIZE_OAUTH_TOKEN_KEY_B64';

function fail(field) {
  throw new Error(`INVALID_OAUTH_FLOW_STORE_RUNTIME:${field}`);
}

function decodeKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(KEY_ENV);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(KEY_ENV);
  return key;
}

export function createOAuthFlowStoreRuntime({ env = process.env, createStore = createOAuthFlowRedisStore, ttlMs, loadRedisModule } = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  if (typeof createStore !== 'function') fail('createStore');
  const redisUrl = typeof env[REDIS_ENV] === 'string' ? env[REDIS_ENV].trim() : '';
  if (!redisUrl) fail(REDIS_ENV);
  const store = createStore({ redisUrl, key: decodeKey(env[KEY_ENV]), ttlMs, loadRedisModule });
  if (!store || typeof store.issue !== 'function' || typeof store.consume !== 'function' || typeof store.close !== 'function') fail('store');
  let closePromise = null;
  function close() {
    if (closePromise) return closePromise;
    closePromise = Promise.resolve().then(() => store.close());
    return closePromise;
  }
  return Object.freeze({
    issue(input) { return store.issue(input); },
    consume(state) { return store.consume(state); },
    close,
    status() { return Object.freeze({ configured: true, storage: 'encrypted-redis' }); }
  });
}

export const OAUTH_FLOW_STORE_ENV = Object.freeze({ redisUrl: REDIS_ENV, key: KEY_ENV });
