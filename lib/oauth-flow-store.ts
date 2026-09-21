const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_FLOWS = 64;
const MAX_FLOWS = 512;
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export interface OAuthFlowInput {
  readonly state: string;
  readonly verifier: string;
  readonly provider: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
}
export interface OAuthFlowRecord extends OAuthFlowInput {
  readonly createdAt: number;
  readonly expiresAt: number;
}
export interface OAuthFlowStore {
  readonly issue: (input: OAuthFlowInput) => { readonly state: string; readonly expiresAt: number };
  readonly consume: (state: string) => OAuthFlowRecord;
  readonly size: () => number;
}
export interface OAuthFlowStoreOptions {
  readonly ttlMs?: number;
  readonly maxFlows?: number;
  readonly now?: () => number;
}

function clone(record: OAuthFlowRecord): OAuthFlowRecord {
  return { ...record, scopes: [...record.scopes] };
}

function positiveInteger(value: unknown, fallback: number, max: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Math.min(Number(value), max) : fallback;
}

function normalizeFlow(input: unknown): OAuthFlowInput {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('INVALID_OAUTH_FLOW:input');
  const source = input as Record<string, unknown>;
  const allowed = new Set(['state','verifier','provider','redirectUri','scopes']);
  for (const key of Object.keys(source)) if (!allowed.has(key)) throw new Error('INVALID_OAUTH_FLOW:field');
  if (typeof source.state !== 'string' || !STATE_PATTERN.test(source.state)) throw new Error('INVALID_OAUTH_FLOW:state');
  if (typeof source.verifier !== 'string' || !VERIFIER_PATTERN.test(source.verifier)) throw new Error('INVALID_OAUTH_FLOW:verifier');
  const provider = typeof source.provider === 'string' ? source.provider.trim() : '';
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(provider)) throw new Error('INVALID_OAUTH_FLOW:provider');
  let redirectUri: URL;
  try { redirectUri = new URL(String(source.redirectUri)); } catch { throw new Error('INVALID_OAUTH_FLOW:redirectUri'); }
  if (redirectUri.protocol !== 'https:' || redirectUri.username || redirectUri.password || redirectUri.hash) throw new Error('INVALID_OAUTH_FLOW:redirectUri');
  if (!Array.isArray(source.scopes) || source.scopes.length < 1 || source.scopes.length > 16) throw new Error('INVALID_OAUTH_FLOW:scopes');
  const scopes = source.scopes.map((scope) => typeof scope === 'string' ? scope.trim() : '');
  if (scopes.some((scope) => !scope || scope.length > 256) || new Set(scopes).size !== scopes.length) throw new Error('INVALID_OAUTH_FLOW:scopes');
  return { state: source.state, verifier: source.verifier, provider, redirectUri: redirectUri.toString(), scopes };
}

export function createOAuthFlowStore({ ttlMs = DEFAULT_TTL_MS, maxFlows = DEFAULT_MAX_FLOWS, now = () => Date.now() }: OAuthFlowStoreOptions = {}): OAuthFlowStore {
  const ttl = positiveInteger(ttlMs, DEFAULT_TTL_MS, 60 * 60 * 1000);
  const capacity = positiveInteger(maxFlows, DEFAULT_MAX_FLOWS, MAX_FLOWS);
  if (typeof now !== 'function') throw new Error('INVALID_OAUTH_FLOW_STORE:now');
  const flows = new Map<string, OAuthFlowRecord>();

  const currentTime = (): number => {
    const value = Number(now());
    if (!Number.isFinite(value)) throw new Error('INVALID_OAUTH_FLOW_STORE:now');
    return value;
  };

  const purgeExpired = (at = currentTime()): void => {
    for (const [state, record] of flows) if (record.expiresAt <= at) flows.delete(state);
  };

  const issue = (input: OAuthFlowInput): { readonly state: string; readonly expiresAt: number } => {
    const flow = normalizeFlow(input);
    const at = currentTime();
    purgeExpired(at);
    if (flows.has(flow.state)) throw new Error('OAUTH_FLOW_STATE_COLLISION');
    if (flows.size >= capacity) throw new Error('OAUTH_FLOW_STORE_FULL');
    const record: OAuthFlowRecord = { ...flow, createdAt: at, expiresAt: at + ttl };
    flows.set(flow.state, record);
    return { state: flow.state, expiresAt: record.expiresAt };
  };

  const consume = (state: string): OAuthFlowRecord => {
    if (typeof state !== 'string' || !STATE_PATTERN.test(state)) throw new Error('INVALID_OAUTH_FLOW:state');
    const at = currentTime();
    const record = flows.get(state);
    if (!record) throw new Error('OAUTH_FLOW_NOT_FOUND');
    flows.delete(state);
    if (record.expiresAt <= at) throw new Error('OAUTH_FLOW_EXPIRED');
    return clone(record);
  };

  const size = (): number => {
    purgeExpired();
    return flows.size;
  };

  return Object.freeze({ issue, consume, size });
}

export const OAUTH_FLOW_DEFAULT_TTL_MS = DEFAULT_TTL_MS;
export const OAUTH_FLOW_MAX_CAPACITY = MAX_FLOWS;
