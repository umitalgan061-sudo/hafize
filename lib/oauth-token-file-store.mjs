import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { decryptOAuthTokenRecord, encryptOAuthTokenRecord } from './oauth-token-encryption.mjs';

const DEFAULT_MAX_FILE_BYTES = 64 * 1024;
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
const PROVIDER_RE = /^[a-z][a-z0-9_-]{0,31}$/;

function fail(field) {
  throw new Error(`INVALID_OAUTH_TOKEN_STORE:${field}`);
}

function normalizeText(value, field, pattern) {
  if (typeof value !== 'string') fail(field);
  const normalized = value.trim();
  if (!pattern.test(normalized)) fail(field);
  return normalized;
}

function normalizeKey(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail('key');
  const key = Buffer.from(value);
  if (key.length !== 32) fail('key');
  return key;
}

function normalizeMaxBytes(value) {
  if (value === undefined) return DEFAULT_MAX_FILE_BYTES;
  if (!Number.isSafeInteger(value) || value < 1024 || value > 1024 * 1024) fail('maxFileBytes');
  return value;
}

function recordKey(ownerId, provider) {
  return createHash('sha256').update(`${ownerId}\0${provider}`, 'utf8').digest('hex');
}

function assertInside(root, target) {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(target);
  if (!normalizedTarget.startsWith(`${normalizedRoot}/`) && normalizedTarget !== normalizedRoot) fail('path');
  return normalizedTarget;
}

export function createOAuthTokenFileStore({
  directory,
  key,
  maxFileBytes,
  fs = { chmod, mkdir, open, readFile, rename, rm, stat },
  createNonce = randomBytes
} = {}) {
  if (typeof directory !== 'string' || !directory.trim()) fail('directory');
  const root = resolve(directory.trim());
  const encryptionKey = normalizeKey(key);
  const maxBytes = normalizeMaxBytes(maxFileBytes);
  if (!fs || typeof fs !== 'object') fail('fs');
  for (const method of ['chmod', 'mkdir', 'open', 'readFile', 'rename', 'rm', 'stat']) {
    if (typeof fs[method] !== 'function') fail(`fs.${method}`);
  }
  if (typeof createNonce !== 'function') fail('createNonce');

  function pathFor(ownerId, provider) {
    const owner = normalizeText(ownerId, 'ownerId', OWNER_RE);
    const source = normalizeText(provider, 'provider', PROVIDER_RE);
    return {
      owner,
      source,
      path: assertInside(root, join(root, `${recordKey(owner, source)}.json`))
    };
  }

  async function ensureRoot() {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    try { await fs.chmod(root, 0o700); } catch { /* Best effort on non-POSIX filesystems. */ }
  }

  async function save(request) {
    const { ownerId, provider, tokenRecord } = request ?? {};
    const target = pathFor(ownerId, provider);
    if (!tokenRecord || Array.isArray(tokenRecord) || typeof tokenRecord !== 'object') fail('tokenRecord');
    const envelope = encryptOAuthTokenRecord({ ownerId: target.owner, provider: target.source, tokenRecord }, encryptionKey);
    const payload = `${JSON.stringify(envelope)}\n`;
    if (Buffer.byteLength(payload, 'utf8') > maxBytes) throw new Error('OAUTH_TOKEN_STORE_TOO_LARGE');

    await ensureRoot();
    const nonce = Buffer.from(createNonce(8)).toString('hex');
    if (!/^[a-f0-9]{16}$/.test(nonce)) throw new Error('OAUTH_TOKEN_STORE_WRITE_FAILED');
    const temporary = assertInside(root, `${target.path}.${nonce}.tmp`);
    let handle;
    try {
      handle = await fs.open(temporary, 'wx', 0o600);
      await handle.writeFile(payload, { encoding: 'utf8' });
      await handle.sync();
      await handle.close();
      handle = null;
      try { await fs.chmod(temporary, 0o600); } catch { /* Best effort. */ }
      await fs.rename(temporary, target.path);
      try { await fs.chmod(target.path, 0o600); } catch { /* Best effort. */ }
    } catch {
      try { await handle?.close(); } catch { /* Ignore cleanup error. */ }
      try { await fs.rm(temporary, { force: true }); } catch { /* Ignore cleanup error. */ }
      throw new Error('OAUTH_TOKEN_STORE_WRITE_FAILED');
    }
    return Object.freeze({ ownerId: target.owner, provider: target.source, stored: true });
  }

  async function load(request) {
    const { ownerId, provider } = request ?? {};
    const target = pathFor(ownerId, provider);
    let metadata;
    try { metadata = await fs.stat(target.path); } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw new Error('OAUTH_TOKEN_STORE_READ_FAILED');
    }
    if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maxBytes) throw new Error('OAUTH_TOKEN_STORE_READ_FAILED');

    let envelope;
    try { envelope = JSON.parse(await fs.readFile(target.path, 'utf8')); } catch { throw new Error('OAUTH_TOKEN_STORE_READ_FAILED'); }
    const decrypted = decryptOAuthTokenRecord(envelope, encryptionKey);
    if (!decrypted || decrypted.ownerId !== target.owner || decrypted.provider !== target.source ||
        !decrypted.tokenRecord || Array.isArray(decrypted.tokenRecord) || typeof decrypted.tokenRecord !== 'object') {
      throw new Error('OAUTH_TOKEN_STORE_SCOPE_MISMATCH');
    }
    return structuredClone(decrypted.tokenRecord);
  }

  async function remove(request) {
    const { ownerId, provider, explicitUserIntent } = request ?? {};
    const target = pathFor(ownerId, provider);
    if (explicitUserIntent !== true) throw new Error('OAUTH_TOKEN_STORE_DELETE_REQUIRES_INTENT');
    try {
      await fs.rm(target.path, { force: false });
      return Object.freeze({ ownerId: target.owner, provider: target.source, deleted: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return Object.freeze({ ownerId: target.owner, provider: target.source, deleted: false });
      throw new Error('OAUTH_TOKEN_STORE_DELETE_FAILED');
    }
  }

  return Object.freeze({ save, load, remove });
}
