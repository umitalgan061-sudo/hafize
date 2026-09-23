import { containsPlaintextCredential } from './plaintext-credential-policy.ts';

const API_ORIGIN = 'https://api.canva.com';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const DESIGN_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const OPERATIONS = new Set(['user.get', 'user.profile', 'user.capabilities', 'design.list', 'design.get']);
const LIST_FIELDS = new Set(['query', 'continuation', 'ownership', 'sortBy', 'limit']);
const OWNERSHIP = new Set(['any', 'owned', 'shared']);
const SORT = new Set(['relevance', 'modified_descending', 'modified_ascending', 'title_descending', 'title_ascending']);

export interface CanvaReadRequest {
  readonly ownerId?: unknown;
  readonly operation?: unknown;
  readonly params?: unknown;
}

export interface CanvaTokenStore {
  readonly load: (input: { readonly ownerId: string; readonly provider: string }) => Promise<unknown> | unknown;
}

export interface CanvaReadClientOptions {
  readonly tokenStore?: CanvaTokenStore | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  readonly now?: (() => number) | undefined;
  readonly maxJsonBytes?: number | undefined;
}

export interface CanvaReadClient {
  readonly read: (request?: CanvaReadRequest) => Promise<Record<string, unknown>>;
}

type JsonRecord = Record<string, unknown>;

function fail(reason: string): never { throw new Error(`INVALID_CANVA_READ:${reason}`); }

function text(value: unknown, field: string, { min = 1, max = 4096 }: { min?: number; max?: number } = {}): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) fail(field);
  return normalized;
}

function strictObject(value: unknown, field: string, allowed: ReadonlySet<string> = new Set()): JsonRecord {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(field);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${field}.${key}`);
  return value as JsonRecord;
}

function scopesOf(record: JsonRecord): ReadonlySet<string> {
  if (!Array.isArray(record.scopes)) fail('token.scopes');
  const scopes = new Set<string>();
  for (const scope of record.scopes) scopes.add(text(scope, 'token.scope', { max: 256 }));
  return scopes;
}

function requireScope(scopes: ReadonlySet<string>, required: string): void {
  if (required && !scopes.has(required)) throw new Error(`CANVA_READ_SCOPE_REQUIRED:${required}`);
}

function listUrl(params: unknown): string {
  const input = params === undefined ? {} : strictObject(params, 'params', LIST_FIELDS);
  const query = new URLSearchParams();
  if (input.query !== undefined) query.set('query', text(input.query, 'params.query', { max: 255 }));
  if (input.continuation !== undefined) query.set('continuation', text(input.continuation, 'params.continuation', { max: 2048 }));
  if (input.ownership !== undefined) {
    const value = text(input.ownership, 'params.ownership', { max: 16 });
    if (!OWNERSHIP.has(value)) fail('params.ownership');
    query.set('ownership', value);
  }
  if (input.sortBy !== undefined) {
    const value = text(input.sortBy, 'params.sortBy', { max: 32 });
    if (!SORT.has(value)) fail('params.sortBy');
    query.set('sort_by', value);
  }
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || Number(input.limit) < 1 || Number(input.limit) > 100) fail('params.limit');
    query.set('limit', String(input.limit));
  }
  const suffix = query.size ? `?${query}` : '';
  return `${API_ORIGIN}/rest/v1/designs${suffix}`;
}

function resolveRequest(operation: string, params: unknown, scopes: ReadonlySet<string>): string {
  if (operation === 'user.get') return `${API_ORIGIN}/rest/v1/users/me`;
  if (operation === 'user.profile') { requireScope(scopes, 'profile:read'); return `${API_ORIGIN}/rest/v1/users/me/profile`; }
  if (operation === 'user.capabilities') { requireScope(scopes, 'profile:read'); return `${API_ORIGIN}/rest/v1/users/me/capabilities`; }
  if (operation === 'design.list') { requireScope(scopes, 'design:meta:read'); return listUrl(params); }
  requireScope(scopes, 'design:meta:read');
  const input = strictObject(params, 'params', new Set(['designId']));
  const designId = text(input.designId, 'params.designId', { max: 256 });
  if (!DESIGN_ID_PATTERN.test(designId)) fail('params.designId');
  return `${API_ORIGIN}/rest/v1/designs/${encodeURIComponent(designId)}`;
}

export function createCanvaReadClient(options: CanvaReadClientOptions = {}): CanvaReadClient {
  const { tokenStore, fetchImpl = globalThis.fetch, now = () => Date.now(), maxJsonBytes = MAX_JSON_BYTES } = options;
  const store: CanvaTokenStore = tokenStore && typeof tokenStore.load === 'function' ? tokenStore : fail('tokenStore');
  if (typeof fetchImpl !== 'function') fail('fetch');
  if (typeof now !== 'function') fail('now');
  if (!Number.isSafeInteger(maxJsonBytes) || maxJsonBytes < 1024 || maxJsonBytes > MAX_JSON_BYTES) fail('maxJsonBytes');

  async function read(request: CanvaReadRequest = {}): Promise<JsonRecord> {
    const { ownerId, operation, params } = request;
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) fail('ownerId');
    const op = text(operation, 'operation', { max: 32 });
    if (!OPERATIONS.has(op)) fail('operation');
    const record = await store.load({ ownerId: owner, provider: 'canva' });
    if (!record || Array.isArray(record) || typeof record !== 'object') throw new Error('CANVA_READ_REAUTH_REQUIRED');
    const token = record as JsonRecord;
    const tokenType = text(token.tokenType, 'token.tokenType', { max: 32 });
    if (tokenType.toLowerCase() !== 'bearer') fail('token.tokenType');
    const accessToken = text(token.accessToken, 'token.accessToken', { min: 16, max: 4096 });
    const expiresAt = Number(token.expiresAt);
    const timestamp = Number(now());
    if (!Number.isFinite(expiresAt) || !Number.isFinite(timestamp)) fail('token.expiresAt');
    if (expiresAt <= timestamp + 30_000) throw new Error('CANVA_READ_REAUTH_REQUIRED');
    const url = resolveRequest(op, params, scopesOf(token));
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      redirect: 'error'
    });
    if (!response?.ok || typeof response.json !== 'function') throw new Error('CANVA_READ_FAILED:http');
    const data = await response.json() as unknown;
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('CANVA_READ_FAILED:response');
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, 'utf8') > maxJsonBytes || serialized.includes(accessToken) || containsPlaintextCredential(serialized)) {
      throw new Error('CANVA_READ_FAILED:response');
    }
    return structuredClone(data) as JsonRecord;
  }

  return Object.freeze({ read });
}

export const CANVA_READ_OPERATIONS = Object.freeze([...OPERATIONS]);
