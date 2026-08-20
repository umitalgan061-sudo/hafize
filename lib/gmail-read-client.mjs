import { fetchBoundedProviderJson } from './provider-json-fetch.mjs';

const API_ORIGIN = 'https://gmail.googleapis.com';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const OPERATIONS = new Set(['profile.get', 'message.list', 'message.get']);
const LIST_FIELDS = new Set(['query', 'pageToken', 'maxResults', 'includeSpamTrash']);

function fail(reason) { throw new Error(`INVALID_GMAIL_READ:${reason}`); }
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
function validSignal(signal) {
  return signal == null || (typeof signal === 'object'
    && typeof signal.aborted === 'boolean'
    && typeof signal.addEventListener === 'function'
    && typeof signal.removeEventListener === 'function');
}
function assertSignal(signal) {
  if (!validSignal(signal)) fail('signal');
  if (signal?.aborted) {
    const error = new Error('GMAIL_READ_FAILED:cancelled');
    error.code = error.message;
    throw error;
  }
}
function requireReadScope(record) {
  if (!Array.isArray(record.scopes) || !record.scopes.includes(READ_SCOPE)) throw new Error('GMAIL_READ_SCOPE_REQUIRED');
}
function listUrl(params) {
  const input = params === undefined ? {} : strictObject(params, 'params', LIST_FIELDS);
  const query = new URLSearchParams();
  if (input.query !== undefined) query.set('q', text(input.query, 'params.query', { max: 512 }));
  if (input.pageToken !== undefined) query.set('pageToken', text(input.pageToken, 'params.pageToken', { max: 2048 }));
  if (input.maxResults !== undefined) {
    if (!Number.isInteger(input.maxResults) || input.maxResults < 1 || input.maxResults > 100) fail('params.maxResults');
    query.set('maxResults', String(input.maxResults));
  }
  if (input.includeSpamTrash !== undefined) {
    if (typeof input.includeSpamTrash !== 'boolean') fail('params.includeSpamTrash');
    query.set('includeSpamTrash', String(input.includeSpamTrash));
  }
  const suffix = query.size ? `?${query}` : '';
  return `${API_ORIGIN}/gmail/v1/users/me/messages${suffix}`;
}
function resolveUrl(operation, params) {
  if (operation === 'profile.get') return `${API_ORIGIN}/gmail/v1/users/me/profile`;
  if (operation === 'message.list') return listUrl(params);
  const input = strictObject(params, 'params', new Set(['messageId', 'format']));
  const messageId = text(input.messageId, 'params.messageId', { max: 256 });
  if (!MESSAGE_ID_PATTERN.test(messageId)) fail('params.messageId');
  const format = input.format === undefined ? 'metadata' : text(input.format, 'params.format', { max: 16 }).toLowerCase();
  if (!['minimal', 'metadata', 'full'].includes(format)) fail('params.format');
  return `${API_ORIGIN}/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=${format}`;
}

export function createGmailReadClient({
  tokenStore,
  refreshAccessToken = null,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  maxJsonBytes = MAX_JSON_BYTES,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
} = {}) {
  if (typeof tokenStore?.load !== 'function') fail('tokenStore');
  if (refreshAccessToken !== null && typeof refreshAccessToken !== 'function') fail('refreshAccessToken');
  if (typeof fetchImpl !== 'function') fail('fetch');
  if (typeof now !== 'function') fail('now');
  if (!Number.isSafeInteger(maxJsonBytes) || maxJsonBytes < 1024 || maxJsonBytes > MAX_JSON_BYTES) fail('maxJsonBytes');

  async function loadFreshRecord(owner, signal) {
    assertSignal(signal);
    let record = await tokenStore.load({ ownerId: owner, provider: 'google' });
    assertSignal(signal);
    if (!record || Array.isArray(record) || typeof record !== 'object') throw new Error('GMAIL_READ_REAUTH_REQUIRED');
    let expiresAt = Number(record.expiresAt);
    const timestamp = Number(now());
    if (!Number.isFinite(expiresAt) || !Number.isFinite(timestamp)) fail('token.expiresAt');
    if (expiresAt <= timestamp + 30_000) {
      if (!refreshAccessToken) throw new Error('GMAIL_READ_REAUTH_REQUIRED');
      assertSignal(signal);
      try {
        // Refresh may be shared/coalesced across callers. Do not forward a caller abort
        // into the shared refresh; instead re-check cancellation before Gmail egress.
        await refreshAccessToken({ ownerId: owner });
      } catch {
        assertSignal(signal);
        throw new Error('GMAIL_READ_REAUTH_REQUIRED');
      }
      assertSignal(signal);
      record = await tokenStore.load({ ownerId: owner, provider: 'google' });
      assertSignal(signal);
      if (!record || Array.isArray(record) || typeof record !== 'object') throw new Error('GMAIL_READ_REAUTH_REQUIRED');
      expiresAt = Number(record.expiresAt);
      const afterRefresh = Number(now());
      if (!Number.isFinite(expiresAt) || !Number.isFinite(afterRefresh)) fail('token.expiresAt');
      if (expiresAt <= afterRefresh + 30_000) throw new Error('GMAIL_READ_REAUTH_REQUIRED');
    }
    return record;
  }

  async function read({ ownerId, operation, params, signal = null } = {}) {
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) fail('ownerId');
    const op = text(operation, 'operation', { max: 32 });
    if (!OPERATIONS.has(op)) fail('operation');
    assertSignal(signal);
    const url = resolveUrl(op, params);
    const record = await loadFreshRecord(owner, signal);
    requireReadScope(record);
    const tokenType = text(record.tokenType, 'token.tokenType', { max: 32 });
    if (tokenType.toLowerCase() !== 'bearer') fail('token.tokenType');
    const accessToken = text(record.accessToken, 'token.accessToken', { min: 16, max: 4096 });
    assertSignal(signal);
    const data = await fetchBoundedProviderJson({
      fetchImpl,
      url,
      init: {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
        redirect: 'error'
      },
      errorPrefix: 'GMAIL_READ_FAILED',
      maxBytes: maxJsonBytes,
      timeoutMs: requestTimeoutMs,
      signal
    });
    assertSignal(signal);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('GMAIL_READ_FAILED:response');
    const serialized = JSON.stringify(data);
    if (serialized.includes(accessToken)) throw new Error('GMAIL_READ_FAILED:response');
    return structuredClone(data);
  }
  return Object.freeze({ read });
}

export const GMAIL_READ_OPERATIONS = Object.freeze([...OPERATIONS]);
export const GMAIL_READ_LIMITS = Object.freeze({
  maxJsonBytes: MAX_JSON_BYTES,
  defaultRequestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS
});