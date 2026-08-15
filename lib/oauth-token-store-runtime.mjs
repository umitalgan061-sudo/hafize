import { createOAuthTokenFileStore } from './oauth-token-file-store.mjs';
import { createOAuthTokenRedisStore } from './oauth-token-redis-store.mjs';

const KEY_ENV = 'HAFIZE_OAUTH_TOKEN_KEY_B64';
const DIR_ENV = 'HAFIZE_OAUTH_TOKEN_STORAGE_DIR';
const REDIS_ENV = 'HAFIZE_OAUTH_TOKEN_REDIS_URL';

function fail(field) {
  throw new Error(`INVALID_OAUTH_TOKEN_STORE_RUNTIME:${field}`);
}

function decodeKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(KEY_ENV);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(KEY_ENV);
  return key;
}

function envText(env, name) {
  return typeof env[name] === 'string' ? env[name].trim() : '';
}

function normalizeDirectory(value) {
  if (!value || value.length > 512 || value.includes('\0')) fail(DIR_ENV);
  return value;
}

export function createOAuthTokenStoreRuntime({
  env = process.env,
  createStore = createOAuthTokenFileStore,
  createRedisStore = createOAuthTokenRedisStore,
  maxFileBytes,
  maxRedisBytes,
  loadRedisModule
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') fail('env');
  if (typeof createStore !== 'function' || typeof createRedisStore !== 'function') fail('storeFactory');

  const key = decodeKey(env[KEY_ENV]);
  const directory = envText(env, DIR_ENV);
  const redisUrl = envText(env, REDIS_ENV);
  if (Boolean(directory) === Boolean(redisUrl)) fail('storage');

  const redisMode = Boolean(redisUrl);
  const store = redisMode
    ? createRedisStore({ redisUrl, key, maxRecordBytes: maxRedisBytes, loadRedisModule })
    : createStore({ directory: normalizeDirectory(directory), key, maxFileBytes });
  if (!store || typeof store.save !== 'function' || typeof store.load !== 'function' || typeof store.remove !== 'function' ||
      (redisMode && typeof store.close !== 'function')) {
    fail('store');
  }

  let closePromise = null;
  function close() {
    if (closePromise) return closePromise;
    closePromise = Promise.resolve(redisMode ? store.close() : undefined);
    return closePromise;
  }

  return Object.freeze({
    save(input) { return store.save(input); },
    load(input) { return store.load(input); },
    remove(input) { return store.remove(input); },
    status() { return Object.freeze({ configured: true, storage: redisMode ? 'encrypted-redis' : 'encrypted-file' }); },
    close
  });
}

export const OAUTH_TOKEN_STORE_ENV = Object.freeze({
  key: KEY_ENV,
  directory: DIR_ENV,
  redisUrl: REDIS_ENV
});
