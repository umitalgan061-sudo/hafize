import { createHash } from 'node:crypto';

const KEY_PREFIX = 'hafize:github-write:approval:v1';
const MAX_URL_LENGTH = 4096;

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

export function createGitHubWriteReplayStore({ redisUrl, createClient } = {}) {
  const url = cleanRedisUrl(redisUrl);
  if (typeof createClient !== 'function') fail('INVALID_GITHUB_WRITE_REPLAY_CLIENT_FACTORY');
  let client = null;
  let connecting = null;

  async function getClient() {
    if (client?.isReady === true) return client;
    if (!connecting) {
      connecting = (async () => {
        const next = createClient({ url });
        if (!next || typeof next.connect !== 'function' || typeof next.set !== 'function') {
          throw new Error('invalid redis client');
        }
        next.on?.('error', () => {});
        await next.connect();
        if (next.isReady !== true) throw new Error('redis not ready');
        client = next;
        return next;
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
      const result = await redis.set(key, 'used', { NX: true, PX: ttlMs });
      return result === 'OK';
    } catch (error) {
      if (error?.code?.startsWith?.('INVALID_GITHUB_WRITE_REPLAY_')) throw error;
      fail('GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE');
    }
  }

  return Object.freeze({ claim });
}

export const GITHUB_WRITE_REPLAY_KEY_PREFIX = KEY_PREFIX;
