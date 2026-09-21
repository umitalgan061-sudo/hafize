import { createOAuthTokenFileStore } from './oauth-token-file-store.mjs';

const KEY_ENV = 'HAFIZE_OAUTH_TOKEN_KEY_B64';
const DIR_ENV = 'HAFIZE_OAUTH_TOKEN_STORAGE_DIR';

function fail(field) {
  throw new Error(`INVALID_OAUTH_TOKEN_STORE_RUNTIME:${field}`);
}

function decodeKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(KEY_ENV);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(KEY_ENV);
  return key;
}

function normalizeDirectory(value) {
  if (typeof value !== 'string') fail(DIR_ENV);
  const directory = value.trim();
  if (!directory || directory.length > 512 || directory.includes('\0')) fail(DIR_ENV);
  return directory;
}

export function createOAuthTokenStoreRuntime({
  env = process.env,
  createStore = createOAuthTokenFileStore,
  maxFileBytes
} = {}) {
  if (!env || typeof env !== 'object') fail('env');
  if (typeof createStore !== 'function') fail('createStore');

  const key = decodeKey(env[KEY_ENV]);
  const directory = normalizeDirectory(env[DIR_ENV]);
  const store = createStore({ directory, key, maxFileBytes });
  if (!store || typeof store.save !== 'function' || typeof store.load !== 'function' || typeof store.remove !== 'function') {
    fail('store');
  }

  return Object.freeze({
    save(input) {
      return store.save(input);
    },
    load(input) {
      return store.load(input);
    },
    remove(input) {
      return store.remove(input);
    },
    status() {
      return Object.freeze({ configured: true, storage: 'encrypted-file' });
    }
  });
}

export const OAUTH_TOKEN_STORE_ENV = Object.freeze({ key: KEY_ENV, directory: DIR_ENV });
