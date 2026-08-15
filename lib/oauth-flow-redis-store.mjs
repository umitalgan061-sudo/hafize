import { createHash } from 'node:crypto';
import { decryptOAuthTokenRecord, encryptOAuthTokenRecord } from './oauth-token-encryption.mjs';

const KEY_PREFIX = 'hafize:oauth-flow:v1';
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_TTL_MS = 60 * 60 * 1000;
const MAX_PAYLOAD_BYTES = 16 * 1024;
const CONNECT_TIMEOUT_MS = 5_000;
const STATE_RE = /^[A-Za-z0-9_-]{32,128}$/;
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/;
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const PROVIDER_RE = /^[a-z][a-z0-9_-]{1,31}$/;
const CONSUME_SCRIPT = `local value=redis.call('GET',KEYS[1]); if value then redis.call('DEL',KEYS[1]); end; return value`;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, field, pattern) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!pattern.test(normalized)) fail(`INVALID_OAUTH_FLOW_REDIS_STORE:${field}`);
  return normalized;
}

function encryptionKey(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail('INVALID_OAUTH_FLOW_REDIS_STORE:key');
  const key = Buffer.from(value);
  if (key.length !== 32) fail('INVALID_OAUTH_FLOW_REDIS_STORE:key');
  return key;
}

function redisUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > 4096 || /[\u0000\r\n]/.test(raw)) fail('INVALID_OAUTH_FLOW_REDIS_STORE:redisUrl');
  let parsed;
  try { parsed = new URL(raw); } catch { fail('INVALID_OAUTH_FLOW_REDIS_STORE:redisUrl'); }
  if (!['redis:', 'rediss:'].includes(parsed.protocol) || !parsed.hostname || parsed.hash) fail('INVALID_OAUTH_FLOW_REDIS_STORE:redisUrl');
  return raw;
}

function positiveTtl(value) {
  if (value === undefined) return DEFAULT_TTL_MS;
  if (!Number.isSafeInteger(value) || value < 1000 || value > MAX_TTL_MS) fail('INVALID_OAUTH_FLOW_REDIS_STORE:ttlMs');
  return value;
}

function currentTime(now) {
  const at = Number(now());
  if (!Number.isSafeInteger(at) || at < 0) fail('INVALID_OAUTH_FLOW_REDIS_STORE:now');
  return at;
}

function normalizeFlow(input, now, ttl) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_OAUTH_FLOW_REDIS_STORE:flow');
  const state = text(input.state, 'state', STATE_RE);
  const verifier = text(input.verifier, 'verifier', VERIFIER_RE);
  const ownerId = text(input.ownerId, 'ownerId', OWNER_RE);
  const provider = text(input.provider, 'provider', PROVIDER_RE);
  let redirect;
  try { redirect = new URL(input.redirectUri); } catch { fail('INVALID_OAUTH_FLOW_REDIS_STORE:redirectUri'); }
  if (redirect.protocol !== 'https:' || redirect.username || redirect.password || redirect.hash) fail('INVALID_OAUTH_FLOW_REDIS_STORE:redirectUri');
  if (!Array.isArray(input.scopes) || input.scopes.length < 1 || input.scopes.length > 16) fail('INVALID_OAUTH_FLOW_REDIS_STORE:scopes');
  const scopes = input.scopes.map((scope) => typeof scope === 'string' ? scope.trim() : '');
  if (scopes.some((scope) => !scope || scope.length > 256) || new Set(scopes).size !== scopes.length) fail('INVALID_OAUTH_FLOW_REDIS_STORE:scopes');
  const issuedAt = currentTime(now);
  return { state, verifier, ownerId, provider, redirectUri: redirect.toString(), scopes, issuedAt, expiresAt: issuedAt + ttl };
}

function keyFor(state) {
  const safeState = text(state, 'state', STATE_RE);
  const digest = createHash('sha256').update('hafize:oauth-flow-state:v1\0').update(safeState).digest('hex');
  return { state: safeState, key: `${KEY_PREFIX}:${digest}` };
}

async function closeClient(client) {
  if (!client) return;
  try {
    if (client.isOpen === true && typeof client.close === 'function') await client.close();
    else client.destroy?.();
  } catch {
    try { client.destroy?.(); } catch { /* sanitized below */ }
    fail('OAUTH_FLOW_STORE_CLOSE_FAILED');
  }
}

export function createOAuthFlowRedisStore({ redisUrl: rawUrl, key, ttlMs, now = () => Date.now(), loadRedisModule = () => import('redis') } = {}) {
  const url = redisUrl(rawUrl);
  const secret = encryptionKey(key);
  const ttl = positiveTtl(ttlMs);
  if (typeof now !== 'function' || typeof loadRedisModule !== 'function') fail('INVALID_OAUTH_FLOW_REDIS_STORE:runtime');
  let client = null;
  let pendingClient = null;
  let connecting = null;
  let closePromise = null;
  let closed = false;

  async function getClient() {
    if (closed) fail('OAUTH_FLOW_STORE_UNAVAILABLE');
    if (client?.isReady === true) return client;
    if (client) {
      const stale = client;
      client = null;
      try { await closeClient(stale); } catch { fail('OAUTH_FLOW_STORE_UNAVAILABLE'); }
    }
    if (!connecting) {
      connecting = (async () => {
        let next;
        try {
          const redis = await loadRedisModule();
          if (closed || typeof redis?.createClient !== 'function') throw new Error('unavailable');
          next = redis.createClient({ url, socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false } });
          if (!next || typeof next.connect !== 'function' || typeof next.set !== 'function' || typeof next.eval !== 'function') throw new Error('invalid client');
          pendingClient = next;
          next.on?.('error', () => {});
          await next.connect();
          if (closed || next.isReady !== true) throw new Error('not ready');
          pendingClient = null;
          client = next;
          return next;
        } catch (error) {
          if (pendingClient === next) pendingClient = null;
          try { await closeClient(next); } catch { /* preserve sanitized availability failure */ }
          throw error;
        }
      })().finally(() => { connecting = null; });
    }
    try { return await connecting; } catch { fail('OAUTH_FLOW_STORE_UNAVAILABLE'); }
  }

  async function issue(input) {
    const flow = normalizeFlow(input, now, ttl);
    const target = keyFor(flow.state);
    const envelope = encryptOAuthTokenRecord({ kind: 'oauth-flow', flow }, secret);
    const payload = JSON.stringify(envelope);
    if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) fail('OAUTH_FLOW_STORE_TOO_LARGE');
    let result;
    try { result = await (await getClient()).set(target.key, payload, { NX: true, PX: ttl }); }
    catch { fail('OAUTH_FLOW_STORE_WRITE_FAILED'); }
    if (result !== 'OK') fail('OAUTH_FLOW_STATE_COLLISION');
    return Object.freeze({ state: flow.state, expiresAt: flow.expiresAt });
  }

  async function consume(state) {
    const target = keyFor(state);
    let payload;
    try { payload = await (await getClient()).eval(CONSUME_SCRIPT, { keys: [target.key], arguments: [] }); }
    catch { fail('OAUTH_FLOW_STORE_READ_FAILED'); }
    if (payload == null) fail('OAUTH_FLOW_NOT_FOUND');
    if (typeof payload !== 'string' || Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) fail('OAUTH_FLOW_STORE_READ_FAILED');
    let decoded;
    try { decoded = decryptOAuthTokenRecord(JSON.parse(payload), secret); } catch { fail('OAUTH_FLOW_STORE_READ_FAILED'); }
    const flow = decoded?.kind === 'oauth-flow' ? decoded.flow : null;
    if (!flow || flow.state !== target.state || currentTime(now) >= flow.expiresAt) fail('OAUTH_FLOW_EXPIRED');
    return Object.freeze({ ...flow, scopes: Object.freeze([...flow.scopes]) });
  }

  function close() {
    if (closePromise) return closePromise;
    closed = true;
    try { pendingClient?.destroy?.(); } catch { /* active close reports sanitized failures */ }
    closePromise = (async () => {
      try { await connecting; } catch { /* startup failure already sanitized */ }
      const active = client;
      client = null;
      await closeClient(active);
    })();
    return closePromise;
  }

  return Object.freeze({ issue, consume, close });
}

export const OAUTH_FLOW_REDIS_LIMITS = Object.freeze({ defaultTtlMs: DEFAULT_TTL_MS, maxTtlMs: MAX_TTL_MS, maxPayloadBytes: MAX_PAYLOAD_BYTES, connectTimeoutMs: CONNECT_TIMEOUT_MS });
