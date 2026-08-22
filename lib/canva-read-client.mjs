const API_ORIGIN = 'https://api.canva.com';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const DESIGN_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const OPERATIONS = new Set(['user.get', 'user.profile', 'user.capabilities', 'design.list', 'design.get']);
const LIST_FIELDS = new Set(['query', 'continuation', 'ownership', 'sortBy', 'limit']);
const OWNERSHIP = new Set(['any', 'owned', 'shared']);
const SORT = new Set(['relevance', 'modified_descending', 'modified_ascending', 'title_descending', 'title_ascending']);

function fail(reason) { throw new Error(`INVALID_CANVA_READ:${reason}`); }
function text(value, field, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) fail(field);
  return normalized;
}
function strictObject(value, field, allowed = new Set()) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(field);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${field}.${key}`);
  return value;
}
function requestObject(value) {
  if (value === undefined) return {};
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('request');
  return value;
}
function scopesOf(record) {
  if (!Array.isArray(record.scopes)) fail('token.scopes');
  const scopes = new Set();
  for (const scope of record.scopes) scopes.add(text(scope, 'token.scope', { max: 256 }));
  return scopes;
}
function requireScope(scopes, required) {
  if (required && !scopes.has(required)) throw new Error(`CANVA_READ_SCOPE_REQUIRED:${required}`);
}
function listUrl(params) {
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
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) fail('params.limit');
    query.set('limit', String(input.limit));
  }
  const suffix = query.size ? `?${query}` : '';
  return `${API_ORIGIN}/rest/v1/designs${suffix}`;
}
function resolveRequest(operation, params, scopes) {
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

export function createCanvaReadClient({ tokenStore, fetchImpl = globalThis.fetch, now = () => Date.now(), maxJsonBytes = MAX_JSON_BYTES } = {}) {
  if (typeof tokenStore?.load !== 'function') fail('tokenStore');
  if (typeof fetchImpl !== 'function') fail('fetch');
  if (typeof now !== 'function') fail('now');
  if (!Number.isSafeInteger(maxJsonBytes) || maxJsonBytes < 1024 || maxJsonBytes > MAX_JSON_BYTES) fail('maxJsonBytes');

  async function read(request) {
    const { ownerId, operation, params } = requestObject(request);
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) fail('ownerId');
    const op = text(operation, 'operation', { max: 32 });
    if (!OPERATIONS.has(op)) fail('operation');
    const record = await tokenStore.load({ ownerId: owner, provider: 'canva' });
    if (!record || Array.isArray(record) || typeof record !== 'object') throw new Error('CANVA_READ_REAUTH_REQUIRED');
    const tokenType = text(record.tokenType, 'token.tokenType', { max: 32 });
    if (tokenType.toLowerCase() !== 'bearer') fail('token.tokenType');
    const accessToken = text(record.accessToken, 'token.accessToken', { min: 16, max: 4096 });
    const expiresAt = Number(record.expiresAt);
    const timestamp = Number(now());
    if (!Number.isFinite(expiresAt) || !Number.isFinite(timestamp)) fail('token.expiresAt');
    if (expiresAt <= timestamp + 30_000) throw new Error('CANVA_READ_REAUTH_REQUIRED');
    const url = resolveRequest(op, params, scopesOf(record));
    const response = await fetchImpl(url, { method: 'GET', headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' }, redirect: 'error' });
    if (!response?.ok || typeof response.json !== 'function') throw new Error('CANVA_READ_FAILED:http');
    const data = await response.json();
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('CANVA_READ_FAILED:response');
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, 'utf8') > maxJsonBytes || serialized.includes(accessToken)) throw new Error('CANVA_READ_FAILED:response');
    return structuredClone(data);
  }

  return Object.freeze({ read });
}

export const CANVA_READ_OPERATIONS = Object.freeze([...OPERATIONS]);
