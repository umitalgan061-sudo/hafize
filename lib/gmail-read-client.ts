import { containsPlaintextCredential } from './plaintext-credential-policy.ts';

const API_ORIGIN = 'https://gmail.googleapis.com';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const OPERATIONS = new Set(['profile.get', 'message.list', 'message.get']);
const LIST_FIELDS = new Set(['query', 'pageToken', 'maxResults', 'includeSpamTrash']);

export interface GmailReadRequest {
  readonly ownerId?: unknown;
  readonly operation?: unknown;
  readonly params?: unknown;
}

export interface GmailTokenStore {
  readonly load: (input: { readonly ownerId: string; readonly provider: string }) => Promise<unknown> | unknown;
}

export interface GmailReadClientOptions {
  readonly tokenStore?: GmailTokenStore | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
  readonly now?: (() => number) | undefined;
  readonly maxJsonBytes?: number | undefined;
}

export interface GmailReadClient {
  readonly read: (request?: GmailReadRequest) => Promise<Record<string, unknown>>;
}

type JsonRecord = Record<string, unknown>;

function fail(reason: string): never { throw new Error(`INVALID_GMAIL_READ:${reason}`); }

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

function requireReadScope(record: JsonRecord): void {
  if (!Array.isArray(record.scopes) || !record.scopes.includes(READ_SCOPE)) throw new Error('GMAIL_READ_SCOPE_REQUIRED');
}

function listUrl(params: unknown): string {
  const input = params === undefined ? {} : strictObject(params, 'params', LIST_FIELDS);
  const query = new URLSearchParams();
  if (input.query !== undefined) query.set('q', text(input.query, 'params.query', { max: 512 }));
  if (input.pageToken !== undefined) query.set('pageToken', text(input.pageToken, 'params.pageToken', { max: 2048 }));
  if (input.maxResults !== undefined) {
    if (!Number.isInteger(input.maxResults) || Number(input.maxResults) < 1 || Number(input.maxResults) > 100) fail('params.maxResults');
    query.set('maxResults', String(input.maxResults));
  }
  if (input.includeSpamTrash !== undefined) {
    if (typeof input.includeSpamTrash !== 'boolean') fail('params.includeSpamTrash');
    query.set('includeSpamTrash', String(input.includeSpamTrash));
  }
  const suffix = query.size ? `?${query}` : '';
  return `${API_ORIGIN}/gmail/v1/users/me/messages${suffix}`;
}

function resolveUrl(operation: string, params: unknown): string {
  if (operation === 'profile.get') return `${API_ORIGIN}/gmail/v1/users/me/profile`;
  if (operation === 'message.list') return listUrl(params);
  const input = strictObject(params, 'params', new Set(['messageId', 'format']));
  const messageId = text(input.messageId, 'params.messageId', { max: 256 });
  if (!MESSAGE_ID_PATTERN.test(messageId)) fail('params.messageId');
  const format = input.format === undefined ? 'metadata' : text(input.format, 'params.format', { max: 16 }).toLowerCase();
  if (!['minimal', 'metadata', 'full'].includes(format)) fail('params.format');
  return `${API_ORIGIN}/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=${format}`;
}

export function createGmailReadClient(options: GmailReadClientOptions = {}): GmailReadClient {
  const { tokenStore, fetchImpl = globalThis.fetch, now = () => Date.now(), maxJsonBytes = MAX_JSON_BYTES } = options;
  const store: GmailTokenStore = tokenStore && typeof tokenStore.load === 'function' ? tokenStore : fail('tokenStore');
  if (typeof fetchImpl !== 'function') fail('fetch');
  if (typeof now !== 'function') fail('now');
  if (!Number.isSafeInteger(maxJsonBytes) || maxJsonBytes < 1024 || maxJsonBytes > MAX_JSON_BYTES) fail('maxJsonBytes');

  async function read(request: GmailReadRequest = {}): Promise<JsonRecord> {
    if (!request || Array.isArray(request) || typeof request !== 'object') fail('request');
    const { ownerId, operation, params } = request;
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) fail('ownerId');
    const op = text(operation, 'operation', { max: 32 });
    if (!OPERATIONS.has(op)) fail('operation');
    const record = await store.load({ ownerId: owner, provider: 'google' });
    if (!record || Array.isArray(record) || typeof record !== 'object') throw new Error('GMAIL_READ_REAUTH_REQUIRED');
    const token = record as JsonRecord;
    requireReadScope(token);
    const tokenType = text(token.tokenType, 'token.tokenType', { max: 32 });
    if (tokenType.toLowerCase() !== 'bearer') fail('token.tokenType');
    const accessToken = text(token.accessToken, 'token.accessToken', { min: 16, max: 4096 });
    const expiresAt = Number(token.expiresAt);
    const timestamp = Number(now());
    if (!Number.isFinite(expiresAt) || !Number.isFinite(timestamp)) fail('token.expiresAt');
    if (expiresAt <= timestamp + 30_000) throw new Error('GMAIL_READ_REAUTH_REQUIRED');
    const response = await fetchImpl(resolveUrl(op, params), {
      method: 'GET',
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      redirect: 'error'
    });
    if (!response?.ok || typeof response.json !== 'function') throw new Error('GMAIL_READ_FAILED:http');
    const data = await response.json() as unknown;
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('GMAIL_READ_FAILED:response');
    const serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, 'utf8') > maxJsonBytes || serialized.includes(accessToken) || containsPlaintextCredential(serialized)) {
      throw new Error('GMAIL_READ_FAILED:response');
    }
    return structuredClone(data) as JsonRecord;
  }

  return Object.freeze({ read });
}

export const GMAIL_READ_OPERATIONS = Object.freeze([...OPERATIONS]);
