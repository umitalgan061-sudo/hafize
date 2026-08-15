import { createRedisOAuthFlowStore } from './redis-oauth-flow-store.mjs';

const MAX_REDIS_URL_LENGTH = 4096;

function fail(code) {
  throw new Error(code);
}

function cleanUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > MAX_REDIS_URL_LENGTH || /[\u0000\r\n]/.test(raw)) fail('INVALID_OAUTH_REDIS_RUNTIME_CONFIG');
  let parsed;
  try { parsed = new URL(raw); } catch { fail('INVALID_OAUTH_REDIS_RUNTIME_CONFIG'); }
  if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.hostname || parsed.hash) {
    fail('INVALID_OAUTH_REDIS_RUNTIME_CONFIG');
  }
  return raw;
}

export function readOAuthRedisRuntimeConfig(env = process.env) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('INVALID_OAUTH_REDIS_RUNTIME_CONFIG');
  const raw = typeof env.HAFIZE_OAUTH_REDIS_URL === 'string' ? env.HAFIZE_OAUTH_REDIS_URL.trim() : '';
  if (!raw) return null;
  const config = {};
  Object.defineProperty(config, 'url', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: cleanUrl(raw)
  });
  return Object.freeze(config);
}

async function defaultLoadRedisModule() {
  return import('redis');
}

async function closeClientQuietly(client) {
  try {
    if (typeof client?.close === 'function' && client.isOpen) await client.close();
    else if (typeof client?.quit === 'function' && client.isOpen) await client.quit();
    else if (typeof client?.disconnect === 'function' && client.isOpen) client.disconnect();
    else client?.destroy?.();
  } catch {
    try { client?.destroy?.(); } catch { /* cleanup must not leak provider detail */ }
  }
}

export async function createRedisOAuthFlowStoreRuntime({
  env = process.env,
  loadRedisModule = defaultLoadRedisModule,
  createStore = createRedisOAuthFlowStore,
  storeOptions = {}
} = {}) {
  if (typeof loadRedisModule !== 'function') fail('INVALID_OAUTH_REDIS_RUNTIME:loadRedisModule');
  if (typeof createStore !== 'function') fail('INVALID_OAUTH_REDIS_RUNTIME:createStore');
  if (!storeOptions || Array.isArray(storeOptions) || typeof storeOptions !== 'object') {
    fail('INVALID_OAUTH_REDIS_RUNTIME:storeOptions');
  }

  const config = readOAuthRedisRuntimeConfig(env);
  if (config == null) {
    return Object.freeze({ configured: false, store: null, close: async () => undefined });
  }

  let client = null;
  let store = null;
  let closePromise = null;
  try {
    const redisModule = await loadRedisModule();
    const createClient = redisModule?.createClient;
    if (typeof createClient !== 'function') throw new Error('redis module unavailable');
    client = createClient({ url: config.url });
    if (!client || typeof client.connect !== 'function' || typeof client.eval !== 'function') {
      throw new Error('invalid redis client');
    }
    await client.connect();
    if (client.isReady !== true) throw new Error('redis client not ready');
    store = createStore({ client, ...storeOptions });
    if (!store || typeof store.issue !== 'function' || typeof store.consume !== 'function' || typeof store.close !== 'function') {
      throw new Error('invalid oauth flow store');
    }
  } catch {
    await closeClientQuietly(client);
    fail('OAUTH_REDIS_RUNTIME_STARTUP_FAILED');
  }

  function close() {
    if (closePromise) return closePromise;
    closePromise = Promise.resolve()
      .then(() => store.close())
      .catch(() => { fail('OAUTH_REDIS_RUNTIME_CLOSE_FAILED'); });
    return closePromise;
  }

  return Object.freeze({ configured: true, store, close });
}

export const OAUTH_REDIS_RUNTIME_ENV = 'HAFIZE_OAUTH_REDIS_URL';
