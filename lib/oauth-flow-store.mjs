const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_FLOWS = 64;
const MAX_FLOWS = 512;
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

function clone(record) {
  return { ...record, scopes: [...record.scopes] };
}

function positiveInteger(value, fallback, max) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

function normalizeFlow(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_OAUTH_FLOW:input');
  const allowed = new Set(['state', 'verifier', 'provider', 'redirectUri', 'scopes']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error('INVALID_OAUTH_FLOW:field');
  if (typeof input.state !== 'string' || !STATE_PATTERN.test(input.state)) throw new Error('INVALID_OAUTH_FLOW:state');
  if (typeof input.verifier !== 'string' || !VERIFIER_PATTERN.test(input.verifier)) throw new Error('INVALID_OAUTH_FLOW:verifier');
  const provider = typeof input.provider === 'string' ? input.provider.trim() : '';
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(provider)) throw new Error('INVALID_OAUTH_FLOW:provider');
  let redirectUri;
  try { redirectUri = new URL(input.redirectUri); } catch { throw new Error('INVALID_OAUTH_FLOW:redirectUri'); }
  if (redirectUri.protocol !== 'https:' || redirectUri.username || redirectUri.password || redirectUri.hash) {
    throw new Error('INVALID_OAUTH_FLOW:redirectUri');
  }
  if (!Array.isArray(input.scopes) || input.scopes.length < 1 || input.scopes.length > 16) {
    throw new Error('INVALID_OAUTH_FLOW:scopes');
  }
  const scopes = input.scopes.map((scope) => typeof scope === 'string' ? scope.trim() : '');
  if (scopes.some((scope) => !scope || scope.length > 256) || new Set(scopes).size !== scopes.length) {
    throw new Error('INVALID_OAUTH_FLOW:scopes');
  }
  return { state: input.state, verifier: input.verifier, provider, redirectUri: redirectUri.toString(), scopes };
}

export function createOAuthFlowStore({
  ttlMs = DEFAULT_TTL_MS,
  maxFlows = DEFAULT_MAX_FLOWS,
  now = () => Date.now()
} = {}) {
  const ttl = positiveInteger(ttlMs, DEFAULT_TTL_MS, 60 * 60 * 1000);
  const capacity = positiveInteger(maxFlows, DEFAULT_MAX_FLOWS, MAX_FLOWS);
  if (typeof now !== 'function') throw new Error('INVALID_OAUTH_FLOW_STORE:now');
  const flows = new Map();

  function currentTime() {
    const value = Number(now());
    if (!Number.isFinite(value)) throw new Error('INVALID_OAUTH_FLOW_STORE:now');
    return value;
  }

  function purgeExpired(at = currentTime()) {
    for (const [state, record] of flows) if (record.expiresAt <= at) flows.delete(state);
  }

  function issue(input) {
    const flow = normalizeFlow(input);
    const at = currentTime();
    purgeExpired(at);
    if (flows.has(flow.state)) throw new Error('OAUTH_FLOW_STATE_COLLISION');
    if (flows.size >= capacity) throw new Error('OAUTH_FLOW_STORE_FULL');
    const record = { ...flow, createdAt: at, expiresAt: at + ttl };
    flows.set(flow.state, record);
    return { state: flow.state, expiresAt: record.expiresAt };
  }

  function consume(state) {
    if (typeof state !== 'string' || !STATE_PATTERN.test(state)) throw new Error('INVALID_OAUTH_FLOW:state');
    const at = currentTime();
    const record = flows.get(state);
    if (!record) throw new Error('OAUTH_FLOW_NOT_FOUND');
    flows.delete(state);
    if (record.expiresAt <= at) throw new Error('OAUTH_FLOW_EXPIRED');
    return clone(record);
  }

  function size() {
    purgeExpired();
    return flows.size;
  }

  return Object.freeze({ issue, consume, size });
}

export const OAUTH_FLOW_DEFAULT_TTL_MS = DEFAULT_TTL_MS;
export const OAUTH_FLOW_MAX_CAPACITY = MAX_FLOWS;
