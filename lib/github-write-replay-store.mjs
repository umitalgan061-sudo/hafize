import { createHash } from 'node:crypto';

const KEY_PREFIX = 'hafize:github-write:approval:v1';
const MAX_URL_LENGTH = 4096;
const CONNECT_TIMEOUT_MS = 5_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cleanRedisUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > MAX_URL_LENGTH || /[\u0000\r\n]/.test(raw)) fail('INVALID_GITHUB_WRITE_REPLAY_REDIS_URL');
  let parsed;
  try { parsed = new URL(raw); } catch { fail('INVALID_GITHUB_WRITE_REPLAY_REDIS_URL'); }
  if ((parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') || !parsed.hostname || parsed.hash) {
    fail('INVALID_GITHUB_WRITE_REPLAY_REDIS_URL');
  }
  return raw;
}

function replayKey(nonce) {
  const value = typeof nonce === 'string' ? nonce : '';
  if (!/^[A-Za-z0-9_-]{22}$/.test(value)) fail('INVALID_GITHUB_WRITE_REPLAY_NONCE');
  const digest = createHash('sha256')
    .update('hafize:github-write-replay:v1\0')
    .update(value, 'utf8')
    .digest('hex');
  return `${KEY_PREFIX}:${digest}`;
}

async function closeRedisClient(target) {
  if (!target) return;
  try {
    if (target.isOpen === true && typeof target.close === 'function') {
      await target.close();
      return;
    }
    target.destroy?.();
  } catch {
    try { target.destroy?.(); } catch { /* shutdown is best effort */ }
  }
}

export function createGitHubWriteReplayStore({ redisUrl, createClient } = {}) {
  const url = cleanRedisUrl(redisUrl);
  if (typeof createClient !== 'function') fail('INVALID_GITHUB_WRITE_REPLAY_CLIENT_FACTORY');
  let client = null;
  let pendingClient = null;
  let connecting = null;
  let closePromise = null;
  let closed = false;

  function assertOpen() {
    if (closed) fail('GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE');
  }

  async function getClient() {
    assertOpen();
    if (client?.isReady === true) return client;
    if (!connecting) {
      connecting = (async () => {
        const next = createClient({
          url,
          socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false }
        });
        if (!next || typeof next.connect !== 'function' || typeof next.set !== 'function') {
          throw new Error('invalid redis client');
        }
        pendingClient = next;
        next.on?.('error', () => {});
        try {
          await next.connect();
          if (closed) {
            await closeRedisClient(next);
            fail('GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE');
          }
          if (next.isReady !== true) throw new Error('redis not ready');
          client = next;
          return next;
        } catch (error) {
          await closeRedisClient(next);
          throw error;
        } finally {
          if (pendingClient === next) pendingClient = null;
        }
      })().finally(() => { connecting = null; });
    }
    return connecting;
  }

  async function claim({ nonce, expiresAt, now = Date.now() } = {}) {
    if (!Number.isSafeInteger(expiresAt) || !Number.isSafeInteger(now) || now < 0) {
      fail('INVALID_GITHUB_WRITE_REPLAY_EXPIRY');
    }
    const ttlMs = expiresAt - now;
    if (ttlMs <= 0) return false;
    const key = replayKey(nonce);
    try {
      const redis = await getClient();
      assertOpen();
      const result = await redis.set(key, 'used', { NX: true, PX: ttlMs });
      return result === 'OK';
    } catch (error) {
      if (error?.code?.startsWith?.('INVALID_GITHUB_WRITE_REPLAY_')) throw error;
      fail('GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE');
    }
  }

  function close() {
    if (closePromise) return closePromise;
    closed = true;
    closePromise = (async () => {
      const pending = pendingClient;
      if (pending && pending !== client) await closeRedisClient(pending);
      try { await connecting; } catch { /* expected when shutdown interrupts connect */ }
      const active = client;
      client = null;
      if (active && active !== pending) await closeRedisClient(active);
    })();
    return closePromise;
  }

  return Object.freeze({ claim, close });
}

export const GITHUB_WRITE_REPLAY_KEY_PREFIX = KEY_PREFIX;
export const GITHUB_WRITE_REPLAY_CONNECT_TIMEOUT_MS = CONNECT_TIMEOUT_MS;
