import { createHash, randomBytes } from 'node:crypto';

const KEY_PREFIX = 'hafize:google-refresh:v1';
const LEASE_MS = 30_000;
const HEARTBEAT_MS = 10_000;
const WAIT_MS = 35_000;
const POLL_MS = 100;
const CONNECT_TIMEOUT_MS = 5_000;
const COMMAND_TIMEOUT_MS = 3_000;
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
const RELEASE_SCRIPT = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
const RENEW_SCRIPT = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end`;

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function fail(code) {
  throw codedError(code);
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

export function createGoogleRefreshLease({
  redisUrl,
  createClient,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  randomBytesImpl = randomBytes,
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (handle) => clearTimeout(handle),
  setCommandTimer = (callback, ms) => setTimeout(callback, ms),
  clearCommandTimer = (handle) => clearTimeout(handle)
} = {}) {
  const url = cleanUrl(redisUrl);
  if (typeof createClient !== 'function') fail('INVALID_GOOGLE_REFRESH_LEASE_CLIENT');
  if (typeof sleep !== 'function' || typeof now !== 'function' || typeof randomBytesImpl !== 'function' ||
      typeof setTimer !== 'function' || typeof clearTimer !== 'function' ||
      typeof setCommandTimer !== 'function' || typeof clearCommandTimer !== 'function') {
    fail('INVALID_GOOGLE_REFRESH_LEASE_RUNTIME');
  }
  let client = null;
  let pendingClient = null;
  let connecting = null;
  let closePromise = null;
  let closed = false;
  const activeHeartbeats = new Set();
  const retiredClients = new WeakSet();

  function retireClient(redis) {
    if (!redis || retiredClients.has(redis)) return;
    retiredClients.add(redis);
    if (client === redis) client = null;
    try { redis.destroy?.(); } catch { /* command deadline already fails closed */ }
  }

  async function closeClientBounded(redis) {
    if (!redis) return;
    if (redis.isOpen !== true || typeof redis.close !== 'function') {
      retireClient(redis);
      return;
    }
    let deadline = null;
    let timedOut = false;
    let rejectDeadline;
    const timeout = new Promise((_, reject) => { rejectDeadline = reject; });
    try {
      deadline = setCommandTimer(() => {
        timedOut = true;
        retireClient(redis);
        rejectDeadline(codedError('GOOGLE_REFRESH_LEASE_CLOSE_FAILED'));
      }, COMMAND_TIMEOUT_MS);
    } catch {
      retireClient(redis);
      fail('GOOGLE_REFRESH_LEASE_CLOSE_FAILED');
    }
    try {
      await Promise.race([Promise.resolve().then(() => redis.close()), timeout]);
      if (!timedOut) {
        try { clearCommandTimer(deadline); }
        catch { retireClient(redis); fail('GOOGLE_REFRESH_LEASE_CLOSE_FAILED'); }
      }
    } catch {
      if (!timedOut) {
        try { clearCommandTimer(deadline); } catch { /* client is retired below */ }
        retireClient(redis);
      }
      fail('GOOGLE_REFRESH_LEASE_CLOSE_FAILED');
    }
  }

  async function runCommand(redis, invoke) {
    if (!redis || retiredClients.has(redis) || closed) fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE');
    let deadline = null;
    let timedOut = false;
    let rejectDeadline;
    const timeout = new Promise((_, reject) => { rejectDeadline = reject; });
    try {
      deadline = setCommandTimer(() => {
        timedOut = true;
        retireClient(redis);
        rejectDeadline(codedError('GOOGLE_REFRESH_LEASE_UNAVAILABLE'));
      }, COMMAND_TIMEOUT_MS);
    } catch {
      retireClient(redis);
      fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE');
    }

    try {
      const result = await Promise.race([Promise.resolve().then(invoke), timeout]);
      if (!timedOut) {
        try { clearCommandTimer(deadline); }
        catch {
          retireClient(redis);
          fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE');
        }
      }
      return result;
    } catch {
      if (!timedOut) {
        try { clearCommandTimer(deadline); } catch { /* client is retired below */ }
        retireClient(redis);
      }
      fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE');
    }
  }

  async function getClient() {
    if (closed) fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE');
    if (client?.isReady === true && !retiredClients.has(client)) return client;
    if (client) {
      const stale = client;
      client = null;
      try { await closeClientBounded(stale); } catch { fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE'); }
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
            try { await closeClientBounded(next); } catch { /* preserve sanitized availability failure */ }
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
      const result = await runCommand(redis, () => redis.set(key, token, { NX: true, PX: LEASE_MS }));
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
              try {
                renewed = await runCommand(redis, () => redis.eval(RENEW_SCRIPT, { keys: [key], arguments: [token, String(LEASE_MS)] }));
              } catch {
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
          try {
            if (!retiredClients.has(redis)) await runCommand(redis, () => redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] }));
          } catch { /* TTL is final safety net */ }
          fail('GOOGLE_REFRESH_LEASE_UNAVAILABLE');
        }

        return Object.freeze({
          async renew() { await renewOwned(); },
          async release() {
            if (released) return;
            released = true;
            cancelHeartbeat();
            try { await renewing; } catch { /* release still attempts exact-token delete when possible */ }
            if (retiredClients.has(redis)) return;
            try { await runCommand(redis, () => redis.eval(RELEASE_SCRIPT, { keys: [key], arguments: [token] })); } catch { /* TTL is final safety net */ }
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
      let cleanupError = null;
      const pending = pendingClient;
      if (pending && pending !== client) {
        pendingClient = null;
        try { await closeClientBounded(pending); } catch (error) { cleanupError = error; }
      }
      try { await connecting; } catch { /* startup failure already sanitized */ }
      const active = client;
      client = null;
      if (active && active !== pending && !retiredClients.has(active)) {
        try { await closeClientBounded(active); } catch (error) { cleanupError ||= error; }
      }
      if (cleanupError) throw cleanupError;
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
  connectTimeoutMs: CONNECT_TIMEOUT_MS,
  commandTimeoutMs: COMMAND_TIMEOUT_MS
});
