import { createHash } from 'node:crypto';
import { normalizeOAuthFlow, normalizeOAuthFlowState, OAUTH_FLOW_DEFAULT_TTL_MS, OAUTH_FLOW_MAX_CAPACITY } from './oauth-flow-store.mjs';

const KEY_PREFIX = 'hafize:oauth-flow:v1';
const INDEX_KEY = `${KEY_PREFIX}:index`;
const DEFAULT_MAX_FLOWS = 64;
const DEFAULT_COMMAND_TIMEOUT_MS = 3_000;
const MAX_PAYLOAD_BYTES = 8 * 1024;
const ISSUE_SCRIPT = `local t=redis.call('TIME')
local now=tonumber(t[1])*1000+math.floor(tonumber(t[2])/1000)
redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',now)
if redis.call('EXISTS',KEYS[2])==1 then return -1 end
if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[2]) then return -2 end
local ok=redis.call('SET',KEYS[2],ARGV[3],'NX','PX',ARGV[1])
if not ok then return -1 end
local expiry=now+tonumber(ARGV[1])
redis.call('ZADD',KEYS[1],expiry,ARGV[4])
return expiry`;
const CONSUME_SCRIPT = `local value=redis.call('GET',KEYS[2])
redis.call('ZREM',KEYS[1],ARGV[1])
if not value then return false end
redis.call('DEL',KEYS[2])
return value`;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function boundedInteger(value, fallback, max) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

function digestState(state) {
  return createHash('sha256').update('hafize:oauth-flow-state:v1\0').update(state).digest('hex');
}

function decodeFlow(state, raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_PAYLOAD_BYTES) fail('OAUTH_FLOW_STORE_CORRUPT');
  let decoded;
  try { decoded = JSON.parse(raw); } catch { fail('OAUTH_FLOW_STORE_CORRUPT'); }
  if (!decoded || Array.isArray(decoded) || typeof decoded !== 'object') fail('OAUTH_FLOW_STORE_CORRUPT');
  const keys = Object.keys(decoded);
  if (keys.length !== 5 || keys.some((key) => !['verifier', 'provider', 'redirectUri', 'scopes', 'ownerId'].includes(key))) {
    fail('OAUTH_FLOW_STORE_CORRUPT');
  }
  try { return normalizeOAuthFlow({ ...decoded, state }); }
  catch { fail('OAUTH_FLOW_STORE_CORRUPT'); }
}

export function createRedisOAuthFlowStore({
  client,
  ttlMs = OAUTH_FLOW_DEFAULT_TTL_MS,
  maxFlows = DEFAULT_MAX_FLOWS,
  commandTimeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  setTimer = (callback, ms) => { const timer = setTimeout(callback, ms); timer.unref?.(); return timer; },
  clearTimer = (handle) => clearTimeout(handle)
} = {}) {
  if (!client || typeof client.eval !== 'function') fail('INVALID_OAUTH_REDIS_STORE_CLIENT');
  if (typeof setTimer !== 'function' || typeof clearTimer !== 'function') fail('INVALID_OAUTH_REDIS_STORE_RUNTIME');
  const ttl = boundedInteger(ttlMs, OAUTH_FLOW_DEFAULT_TTL_MS, 60 * 60 * 1000);
  const capacity = boundedInteger(maxFlows, DEFAULT_MAX_FLOWS, OAUTH_FLOW_MAX_CAPACITY);
  const commandTimeout = boundedInteger(commandTimeoutMs, DEFAULT_COMMAND_TIMEOUT_MS, 30_000);
  let retired = false;
  let closePromise = null;

  function retire() {
    if (retired) return;
    retired = true;
    try { client.destroy?.(); } catch { /* fail-closed state is already sticky */ }
  }

  async function evalBounded(script, options) {
    if (retired || client.isReady === false) fail('OAUTH_FLOW_STORE_UNAVAILABLE');
    let timer = null;
    let rejectDeadline;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    try {
      timer = setTimer(() => rejectDeadline(new Error('deadline')), commandTimeout);
    } catch {
      retire();
      fail('OAUTH_FLOW_STORE_UNAVAILABLE');
    }
    let result;
    try {
      result = await Promise.race([Promise.resolve().then(() => client.eval(script, options)), deadline]);
    } catch {
      try { clearTimer(timer); } catch { /* client is retired below */ }
      retire();
      fail('OAUTH_FLOW_STORE_UNAVAILABLE');
    }
    try { clearTimer(timer); }
    catch {
      retire();
      fail('OAUTH_FLOW_STORE_UNAVAILABLE');
    }
    return result;
  }

  async function issue(input) {
    const flow = normalizeOAuthFlow(input);
    const digest = digestState(flow.state);
    const payload = JSON.stringify({
      verifier: flow.verifier,
      provider: flow.provider,
      redirectUri: flow.redirectUri,
      scopes: flow.scopes,
      ownerId: flow.ownerId
    });
    if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) fail('INVALID_OAUTH_FLOW:payload');
    const result = Number(await evalBounded(ISSUE_SCRIPT, {
      keys: [INDEX_KEY, `${KEY_PREFIX}:${digest}`],
      arguments: [String(ttl), String(capacity), payload, digest]
    }));
    if (result === -1) fail('OAUTH_FLOW_STATE_COLLISION');
    if (result === -2) fail('OAUTH_FLOW_STORE_FULL');
    if (!Number.isSafeInteger(result) || result < 0) {
      retire();
      fail('OAUTH_FLOW_STORE_UNAVAILABLE');
    }
    return Object.freeze({ state: flow.state, expiresAt: result });
  }

  async function consume(state) {
    const safeState = normalizeOAuthFlowState(state);
    const digest = digestState(safeState);
    const raw = await evalBounded(CONSUME_SCRIPT, {
      keys: [INDEX_KEY, `${KEY_PREFIX}:${digest}`],
      arguments: [digest]
    });
    if (raw === null || raw === false) fail('OAUTH_FLOW_NOT_FOUND');
    return decodeFlow(safeState, raw);
  }

  function close() {
    if (closePromise) return closePromise;
    closePromise = (async () => {
      if (retired) return;
      retired = true;
      if (client.isOpen !== true) return;
      const closeClient = typeof client.close === 'function' ? () => client.close()
        : typeof client.quit === 'function' ? () => client.quit() : null;
      if (!closeClient) { try { client.destroy?.(); } catch { /* already closed logically */ } return; }
      let timer = null;
      let rejectDeadline;
      const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
      try { timer = setTimer(() => rejectDeadline(new Error('deadline')), commandTimeout); }
      catch {
        try { client.destroy?.(); } catch { /* preserve sanitized close failure */ }
        fail('OAUTH_FLOW_STORE_CLOSE_FAILED');
      }
      try { await Promise.race([Promise.resolve().then(closeClient), deadline]); }
      catch {
        try { clearTimer(timer); } catch { /* destroy below is final cleanup */ }
        try { client.destroy?.(); } catch { /* preserve sanitized close failure */ }
        fail('OAUTH_FLOW_STORE_CLOSE_FAILED');
      }
      try { clearTimer(timer); }
      catch {
        try { client.destroy?.(); } catch { /* preserve sanitized close failure */ }
        fail('OAUTH_FLOW_STORE_CLOSE_FAILED');
      }
    })();
    return closePromise;
  }

  return Object.freeze({ issue, consume, close });
}

export const OAUTH_REDIS_FLOW_LIMITS = Object.freeze({
  commandTimeoutMs: DEFAULT_COMMAND_TIMEOUT_MS,
  maxPayloadBytes: MAX_PAYLOAD_BYTES
});
