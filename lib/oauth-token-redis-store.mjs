import { createHash } from 'node:crypto';
import { decryptOAuthTokenRecord, encryptOAuthTokenRecord } from './oauth-token-encryption.mjs';

const KEY_PREFIX = 'hafize:oauth-token:v1';
const MAX_REDIS_URL_BYTES = 4096;
const DEFAULT_MAX_RECORD_BYTES = 64 * 1024;
const MAX_RECORD_BYTES = 1024 * 1024;
const CONNECT_TIMEOUT_MS = 5_000;
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const PROVIDER_RE = /^[a-z][a-z0-9_-]{0,31}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function normalizeText(value, field, pattern) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!pattern.test(text)) fail(`INVALID_OAUTH_TOKEN_REDIS_STORE:${field}`);
  return text;
}

function normalizeKey(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail('INVALID_OAUTH_TOKEN_REDIS_STORE:key');
  const key = Buffer.from(value);
  if (key.length !== 32) fail('INVALID_OAUTH_TOKEN_REDIS_STORE:key');
  return key;
}

function normalizeUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || Buffer.byteLength(raw, 'utf8') > MAX_REDIS_URL_BYTES || /[\u0000\r\n]/.test(raw)) fail('INVALID_OAUTH_TOKEN_REDIS_STORE:redisUrl');
  let parsed;
  try { parsed = new URL(raw); } catch { fail('INVALID_OAUTH_TOKEN_REDIS_STORE:redisUrl'); }
  if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.hostname || parsed.hash) fail('INVALID_OAUTH_TOKEN_REDIS_STORE:redisUrl');
  return raw;
}

function normalizeMaxBytes(value) {
  if (value === undefined) return DEFAULT_MAX_RECORD_BYTES;
  if (!Number.isSafeInteger(value) || value < 1024 || value > MAX_RECORD_BYTES) fail('INVALID_OAUTH_TOKEN_REDIS_STORE:maxRecordBytes');
  return value;
}

function redisKey(ownerId, provider) {
  const owner = normalizeText(ownerId, 'ownerId', OWNER_RE);
  const source = normalizeText(provider, 'provider', PROVIDER_RE);
  const digest = createHash('sha256').update('hafize:oauth-token-key:v1\0').update(owner).update('\0').update(source).digest('hex');
  return { owner, source, key: `${KEY_PREFIX}:${digest}` };
}

async function closeClient(client) {
  if (!client) return;
  try {
    if (client.isOpen === true && typeof client.close === 'function') await client.close();
    else client.destroy?.();
  } catch {
    try { client.destroy?.(); } catch { /* sanitized below */ }
    fail('OAUTH_TOKEN_STORE_CLOSE_FAILED');
  }
}

export function createOAuthTokenRedisStore({
  redisUrl,
  key,
  maxRecordBytes,
  loadRedisModule = () => import('redis')
} = {}) {
  const url = normalizeUrl(redisUrl);
  const encryptionKey = normalizeKey(key);
  const maxBytes = normalizeMaxBytes(maxRecordBytes);
  if (typeof loadRedisModule !== 'function') fail('INVALID_OAUTH_TOKEN_REDIS_STORE:loadRedisModule');
  let client = null;
  let pendingClient = null;
  let connecting = null;
  let closePromise = null;
  let closed = false;

  async function getClient() {
    if (closed) fail('OAUTH_TOKEN_STORE_UNAVAILABLE');
    if (client?.isReady === true) return client;
    if (client) {
      const stale = client;
      client = null;
      try { await closeClient(stale); } catch { fail('OAUTH_TOKEN_STORE_UNAVAILABLE'); }
    }
    if (!connecting) {
      connecting = (async () => {
        let next;
        try {
          const redis = await loadRedisModule();
          if (closed || typeof redis?.createClient !== 'function') throw new Error('unavailable');
          next = redis.createClient({ url, socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false } });
          if (!next || typeof next.connect !== 'function' || typeof next.get !== 'function' || typeof next.set !== 'function' || typeof next.del !== 'function') throw new Error('invalid client');
          pendingClient = next;
          next.on?.('error', () => {});
          await next.connect();
          if (closed || next.isReady !== true) throw new Error('not ready');
          pendingClient = null;
          client = next;
          return next;
        } catch (error) {
          if (pendingClient === next) pendingClient = null;
          try { await closeClient(next); } catch { /* preserve availability boundary */ }
          throw error;
        }
      })().finally(() => { connecting = null; });
    }
    try { return await connecting; } catch { fail('OAUTH_TOKEN_STORE_UNAVAILABLE'); }
  }

  async function save({ ownerId, provider, tokenRecord } = {}) {
    const target = redisKey(ownerId, provider);
    if (!tokenRecord || Array.isArray(tokenRecord) || typeof tokenRecord !== 'object') fail('INVALID_OAUTH_TOKEN_REDIS_STORE:tokenRecord');
    const payload = JSON.stringify(encryptOAuthTokenRecord({ ownerId: target.owner, provider: target.source, tokenRecord }, encryptionKey));
    if (Buffer.byteLength(payload, 'utf8') > maxBytes) fail('OAUTH_TOKEN_STORE_TOO_LARGE');
    try { await (await getClient()).set(target.key, payload); }
    catch (error) { if (error?.code === 'OAUTH_TOKEN_STORE_TOO_LARGE') throw error; fail('OAUTH_TOKEN_STORE_WRITE_FAILED'); }
    return Object.freeze({ ownerId: target.owner, provider: target.source, stored: true });
  }

  async function load({ ownerId, provider } = {}) {
    const target = redisKey(ownerId, provider);
    let payload;
    try { payload = await (await getClient()).get(target.key); } catch { fail('OAUTH_TOKEN_STORE_READ_FAILED'); }
    if (payload == null) return null;
    if (typeof payload !== 'string' || Buffer.byteLength(payload, 'utf8') <= 0 || Buffer.byteLength(payload, 'utf8') > maxBytes) fail('OAUTH_TOKEN_STORE_READ_FAILED');
    let decoded;
    try { decoded = decryptOAuthTokenRecord(JSON.parse(payload), encryptionKey); } catch { fail('OAUTH_TOKEN_STORE_READ_FAILED'); }
    if (!decoded || decoded.ownerId !== target.owner || decoded.provider !== target.source || !decoded.tokenRecord || Array.isArray(decoded.tokenRecord) || typeof decoded.tokenRecord !== 'object') fail('OAUTH_TOKEN_STORE_SCOPE_MISMATCH');
    return structuredClone(decoded.tokenRecord);
  }

  async function remove({ ownerId, provider, explicitUserIntent } = {}) {
    const target = redisKey(ownerId, provider);
    if (explicitUserIntent !== true) fail('OAUTH_TOKEN_STORE_DELETE_REQUIRES_INTENT');
    let deleted;
    try { deleted = Number(await (await getClient()).del(target.key)); } catch { fail('OAUTH_TOKEN_STORE_DELETE_FAILED'); }
    return Object.freeze({ ownerId: target.owner, provider: target.source, deleted: deleted > 0 });
  }

  function close() {
    if (closePromise) return closePromise;
    closed = true;
    pendingClient?.destroy?.();
    closePromise = (async () => {
      try { await connecting; } catch { /* connection failure already sanitized */ }
      const active = client;
      client = null;
      await closeClient(active);
    })();
    return closePromise;
  }

  return Object.freeze({ save, load, remove, close });
}

export const OAUTH_TOKEN_REDIS_STORE_LIMITS = Object.freeze({
  defaultMaxRecordBytes: DEFAULT_MAX_RECORD_BYTES,
  maxRecordBytes: MAX_RECORD_BYTES,
  connectTimeoutMs: CONNECT_TIMEOUT_MS
});
