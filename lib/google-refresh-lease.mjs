import { createHash, randomBytes } from 'node:crypto';

const KEY_PREFIX = 'hafize:google-refresh:v1';
const LEASE_MS = 30_000;
const HEARTBEAT_MS = 10_000;
const WAIT_MS = 35_000;
const POLL_MS = 100;
const CONNECT_TIMEOUT_MS = 5_000;
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
const RELEASE_SCRIPT = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
const RENEW_SCRIPT = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end`;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function cleanUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.length > 4096 || /[\u0000\r\n]/.test(raw)) fail('INVALID_GOOGLE_REFRESH_LEASE_URL');
  let parsed;
  try { parsed = new URL(raw); } catch { fail('INVALID_GOOGLE_REFRESH_LEASE_URL'); }
  if ((parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') || !parsed.hostname || parsed.hash) fail('INVALID_GOOGLE_REFRESH_LEASE_URL');
  return raw;
}

function keyFor(ownerId) {
  const owner = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!OWNER_RE.test(owner)) fail('INVALID_GOOGLE_REFRESH_LEASE_OWNER');
  const digest = createHash('sha256').update('hafize:google-refresh-owner:v1\0').update(owner).digest('hex');
  return `${KEY_PREFIX}:${digest}`;
}

async function closeClient(client) {
  if (!client) return;
  try {
    if (client.isOpen === true && typeof client.close === 'function') await client.close();
    else client.destroy?.();
  } catch {
    try { client.destroy?.(); } catch { /* sanitized below */ }
    fail('GOOGLE_REFRESH_LEASE_CLOSE_FAILED');
  }
}

export function createGoogleRefreshLease({
  redisUrl,
  createClient,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  randomBytesImpl = randomBytes,
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (handle) => clearTimeout(handle)
} = {}) {
  const url = cleanUrl(redisUrl);
  if (typeof createClient !== 'function') fail('INVALID_GOOGLE_REFRESH_LEASE_CLIENT');
  if (typeof sleep !== 'function' || typeof now !== 'function' || typeof randomBytesImpl !== 'function' || typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
    fail('INVALID_GOOGLE_REFRESH_LEASE_RUNTIME');
  }
  let client = null;
  let pendingClient = null;
  let connecting = null;
  let closePromise = null;
  let closed = false;
  const activeHeartbeats = new Set();

  async function getClient() {
    if (closed) fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE');
    if (client?.isReady === true) return client;
    if (client) {
      const stale = client;
      client = null;
      try { await closeClient(stale); } catch { fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE'); }
    }
    if (!connecting) {
      connecting = (async () => {
        const next = createClient({ url, socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false } });
        if (!next || typeof next.connect !== 'function' || typeof next.set !== 'function' || typeof next.eval !== 'function') throw new Error('invalid client');
        pendingClient = next;
        next.on?.('error', () => {});
        try {
          await next.connect();
          if (closed || next.isReady !== true) throw new Error('not ready');
          client = next;
          return next;
        } catch (error) {
          if (pendingClient === next) {
            try { await closeClient(next); } catch { /* preserve sanitized availability failure */ }
          }
          throw error;
        } finally {
          if (pendingClient === next) pendingClient = null;
        }
      })().finally(() => { connecting = null; });
    }
    try { return await connecting; } catch { fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE'); }
  }

  async function acquire({ ownerId } = {}) {
    const key = keyFor(ownerId);
    const token = Buffer.from(randomBytesImpl(16)).toString('base64url');
    if (!TOKEN_RE.test(token)) fail('INVALID_GOOGLE_REFRESH_LEASE_TOKEN');
    const started = Number(now());
    if (!Number.isSafeInteger(started) || started < 0) fail('INVALID_GOOGLE_REFRESH_LEASE_CLOCK');
    while (true) {
      const redis = await getClient();
      let result;
      try { result = await redis.set(key, token, { NX: true, PX: LEASE_MS }); }
      catch { fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE'); }
      if (result === 'OK') {
        let released = false;
        let lostCode = null;
        let timer = null;
        let renewing = null;

        function cancelHeartbeat() {
          if (timer !== null) {
            try { clearTimer(timer); } catch { /* timer cleanup is best effort */ }
            timer = null;
          }
          activeHeartbeats.delete(cancelHeartbeat);
        }

        async function renewOwned() {
          if (released || closed) fail('GOOGLE_REFRESH_LEASE_LOST');
          if (lostCode) fail(lostCode);
          if (!renewing) {
            renewing = (async () => {
              let renewed;
              try { renewed = await redis.eval(RENEW_SCRIPT, { keys: [key], arguments: [token, String(LEASE_MS)] }); }
              catch {
                lostCode = 'GOOGLE_REFRESH_LEASE_UNAVAILABLE';
                fail(lostCode);
              }
              if (Number(renewed) !== 1) {
                lostCode = 'GOOGLE_REFRESH_LEASE_LOST';
                fail(lostCode);
              }
            })().finally(() => { renewing = null; });
          }
          return renewing;
        }

        function scheduleHeartbeat() {
          if (released || closed || lostCode || timer !== null) return;
          try {
            timer = setTimer(async () => {
              timer = null;
              try {
                await renewOwned();
                scheduleHeartbeat();
              } catch {
                if (!lostCode) lostCode = 'GOOGLE_REFRESH_LEASE_UNAVAILABLE';
                cancelHeartbeat();
              }
            }, HEARTBEAT_MS);
          } catch {
            lostCode = 'GOOGLE_REFRESH_LEASE_UNAVAILABLE';
            fail(lostCode);
          }
        }

        activeHeartbeats.add(cancelHeartbeat);
        try { scheduleHeartbeat(); }
        catch {
          cancelHeartbeat();
          try { await redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] }); } catch { /* TTL is final safety net */ }
          fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE');
        }

        return Object.freeze({
          async renew() { await renewOwned(); },
          async release() {
            if (released) return;
            released = true;
            cancelHeartbeat();
            try { await renewing; } catch { /* release still attempts exact-token delete */ }
            try { await redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] }); } catch { /* TTL is final safety net */ }
          }
        });
      }
      const at = Number(now());
      if (!Number.isSafeInteger(at) || at < started) fail('INVALID_GOOGLE_REFRESH_LEASE_CLOCK');
      if (at - started >= WAIT_MS) fail('GOOGLE_REFRESH_LEASE_BUSY');
      await sleep(Math.min(POLL_MS, WAIT_MS - (at - started)));
    }
  }

  function close() {
    if (closePromise) return closePromise;
    closed = true;
    for (const cancel of [...activeHeartbeats]) cancel();
    closePromise = (async () => {
      const pending = pendingClient;
      if (pending && pending !== client) {
        pendingClient = null;
        await closeClient(pending);
      }
      try { await connecting; } catch { /* startup failure already sanitized */ }
      const active = client;
      client = null;
      if (active && active !== pending) await closeClient(active);
    })();
    return closePromise;
  }

  return Object.freeze({ acquire, close });
}

export const GOOGLE_REFRESH_LEASE_LIMITS = Object.freeze({
  leaseMs: LEASE_MS,
  heartbeatMs: HEARTBEAT_MS,
  waitMs: WAIT_MS,
  pollMs: POLL_MS,
  connectTimeoutMs: CONNECT_TIMEOUT_MS
});
