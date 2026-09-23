// @ts-ignore Encrypted token file store is still a legacy JavaScript leaf.
import { createOAuthTokenFileStore } from './oauth-token-file-store.mjs';

const KEY_ENV = 'HAFIZE_OAUTH_TOKEN_KEY_B64';
const DIR_ENV = 'HAFIZE_OAUTH_TOKEN_STORAGE_DIR';

export interface OAuthTokenStore {
  readonly save: (input: unknown) => unknown;
  readonly load: (input: unknown) => unknown;
  readonly remove: (input: unknown) => unknown;
}

export interface OAuthTokenStoreRuntime extends OAuthTokenStore {
  readonly status: () => Readonly<{ configured: true; storage: 'encrypted-file' }>;
}

export interface OAuthTokenStoreRuntimeOptions {
  readonly env?: Record<string, unknown> | undefined;
  readonly createStore?: ((input: { directory: string; key: Buffer; maxFileBytes?: unknown }) => unknown) | undefined;
  readonly maxFileBytes?: unknown;
}

function fail(field: string): never {
  throw new Error(`INVALID_OAUTH_TOKEN_STORE_RUNTIME:${field}`);
}

function decodeKey(value: unknown): Buffer {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) fail(KEY_ENV);
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail(KEY_ENV);
  return key;
}

function normalizeDirectory(value: unknown): string {
  if (typeof value !== 'string') fail(DIR_ENV);
  const directory = value.trim();
  if (!directory || directory.length > 512 || directory.includes('\0')) fail(DIR_ENV);
  return directory;
}

function isTokenStore(value: unknown): value is OAuthTokenStore {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OAuthTokenStore>;
  return typeof candidate.save === 'function'
    && typeof candidate.load === 'function'
    && typeof candidate.remove === 'function';
}

export function createOAuthTokenStoreRuntime(
  options: OAuthTokenStoreRuntimeOptions = {}
): OAuthTokenStoreRuntime {
  const {
    env = process.env as Record<string, unknown>,
    createStore = createOAuthTokenFileStore,
    maxFileBytes
  } = options;

  if (!env || typeof env !== 'object') fail('env');
  if (typeof createStore !== 'function') fail('createStore');

  const key = decodeKey(env[KEY_ENV]);
  const directory = normalizeDirectory(env[DIR_ENV]);
  const store = createStore({ directory, key, maxFileBytes });
  if (!isTokenStore(store)) fail('store');

  return Object.freeze({
    save(input: unknown) {
      return store.save(input);
    },
    load(input: unknown) {
      return store.load(input);
    },
    remove(input: unknown) {
      return store.remove(input);
    },
    status() {
      return Object.freeze({ configured: true as const, storage: 'encrypted-file' as const });
    }
  });
}

export const OAUTH_TOKEN_STORE_ENV = Object.freeze({ key: KEY_ENV, directory: DIR_ENV });
