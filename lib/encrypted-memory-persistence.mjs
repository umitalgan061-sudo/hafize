import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENVELOPE_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BYTES = 16;
const MAX_CIPHERTEXT_BYTES = 2 * 1024 * 1024;
const ENVELOPE_FIELDS = new Set(['version', 'algorithm', 'iv', 'tag', 'ciphertext']);

function fail(error) {
  return { ok: false, error };
}

function decodeBase64(value, label, maxBytes) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`INVALID_MEMORY_ENVELOPE:${label}`);
  }
  const buffer = Buffer.from(value, 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes || buffer.toString('base64') !== value) {
    throw new Error(`INVALID_MEMORY_ENVELOPE:${label}`);
  }
  return buffer;
}

function normalizeKey(value) {
  let key;
  if (Buffer.isBuffer(value)) key = Buffer.from(value);
  else if (value instanceof Uint8Array) key = Buffer.from(value);
  else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) throw new Error('INVALID_MEMORY_ENCRYPTION_KEY');
    key = Buffer.from(trimmed, 'base64');
    if (key.toString('base64') !== trimmed) throw new Error('INVALID_MEMORY_ENCRYPTION_KEY');
  } else {
    throw new Error('INVALID_MEMORY_ENCRYPTION_KEY');
  }
  if (key.length !== KEY_BYTES) throw new Error('INVALID_MEMORY_ENCRYPTION_KEY');
  return key;
}

function normalizeEnvelope(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') {
    throw new Error('INVALID_MEMORY_ENVELOPE:input');
  }
  for (const key of Object.keys(input)) {
    if (!ENVELOPE_FIELDS.has(key)) throw new Error('INVALID_MEMORY_ENVELOPE:field');
  }
  if (input.version !== ENVELOPE_VERSION) throw new Error('INVALID_MEMORY_ENVELOPE:version');
  if (input.algorithm !== ALGORITHM) throw new Error('INVALID_MEMORY_ENVELOPE:algorithm');
  const iv = decodeBase64(input.iv, 'iv', IV_BYTES);
  const tag = decodeBase64(input.tag, 'tag', TAG_BYTES);
  const ciphertext = decodeBase64(input.ciphertext, 'ciphertext', MAX_CIPHERTEXT_BYTES);
  if (iv.length !== IV_BYTES) throw new Error('INVALID_MEMORY_ENVELOPE:iv');
  if (tag.length !== TAG_BYTES) throw new Error('INVALID_MEMORY_ENVELOPE:tag');
  return { iv, tag, ciphertext };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object') {
    throw new Error('INVALID_MEMORY_SNAPSHOT');
  }
  if (!Number.isInteger(snapshot.schemaVersion) || !Array.isArray(snapshot.entries)) {
    throw new Error('INVALID_MEMORY_SNAPSHOT');
  }
  return snapshot;
}

function aad(ownerId) {
  if (typeof ownerId !== 'string' || !ownerId.trim() || ownerId.length > 200) {
    throw new Error('INVALID_MEMORY_OWNER');
  }
  return Buffer.from(`hafize:personal-memory:${ownerId.trim()}:v${ENVELOPE_VERSION}`, 'utf8');
}

export function encryptMemorySnapshot({ ownerId, snapshot, key, random = randomBytes } = {}) {
  try {
    const encryptionKey = normalizeKey(key);
    const normalizedSnapshot = normalizeSnapshot(snapshot);
    if (typeof random !== 'function') throw new Error('INVALID_MEMORY_RANDOM_SOURCE');
    const iv = Buffer.from(random(IV_BYTES));
    if (iv.length !== IV_BYTES) throw new Error('INVALID_MEMORY_RANDOM_SOURCE');
    const plaintext = Buffer.from(JSON.stringify(normalizedSnapshot), 'utf8');
    if (plaintext.length > MAX_CIPHERTEXT_BYTES) throw new Error('MEMORY_SNAPSHOT_TOO_LARGE');

    const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
    cipher.setAAD(aad(ownerId));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ok: true,
      envelope: {
        version: ENVELOPE_VERSION,
        algorithm: ALGORITHM,
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: ciphertext.toString('base64')
      }
    };
  } catch (error) {
    return fail(error.message);
  }
}

export function decryptMemorySnapshot({ ownerId, envelope, key } = {}) {
  try {
    const encryptionKey = normalizeKey(key);
    const normalized = normalizeEnvelope(envelope);
    const decipher = createDecipheriv(ALGORITHM, encryptionKey, normalized.iv);
    decipher.setAAD(aad(ownerId));
    decipher.setAuthTag(normalized.tag);
    const plaintext = Buffer.concat([
      decipher.update(normalized.ciphertext),
      decipher.final()
    ]);
    const parsed = JSON.parse(plaintext.toString('utf8'));
    return { ok: true, snapshot: normalizeSnapshot(parsed) };
  } catch (error) {
    if (error instanceof SyntaxError) return fail('INVALID_MEMORY_SNAPSHOT');
    if (error?.code === 'ERR_OSSL_EVP_BAD_DECRYPT' || /authenticate data/.test(error?.message || '')) {
      return fail('MEMORY_DECRYPT_FAILED');
    }
    return fail(error.message);
  }
}

export function createEncryptedMemoryPersistence({
  readEnvelope,
  writeEnvelope,
  deleteEnvelope,
  keyProvider
} = {}) {
  if (typeof readEnvelope !== 'function') throw new Error('INVALID_MEMORY_PERSISTENCE:readEnvelope');
  if (typeof writeEnvelope !== 'function') throw new Error('INVALID_MEMORY_PERSISTENCE:writeEnvelope');
  if (typeof deleteEnvelope !== 'function') throw new Error('INVALID_MEMORY_PERSISTENCE:deleteEnvelope');
  if (typeof keyProvider !== 'function') throw new Error('INVALID_MEMORY_PERSISTENCE:keyProvider');

  async function resolveKey(ownerId) {
    const key = await keyProvider(ownerId);
    return normalizeKey(key);
  }

  async function load(ownerId) {
    try {
      const envelope = await readEnvelope(ownerId);
      if (envelope == null) return { ok: true, snapshot: null };
      return decryptMemorySnapshot({ ownerId, envelope, key: await resolveKey(ownerId) });
    } catch (error) {
      return fail(error.message);
    }
  }

  async function save(ownerId, snapshot) {
    try {
      const encrypted = encryptMemorySnapshot({ ownerId, snapshot, key: await resolveKey(ownerId) });
      if (!encrypted.ok) return encrypted;
      await writeEnvelope(ownerId, encrypted.envelope);
      return { ok: true };
    } catch (error) {
      return fail(error.message);
    }
  }

  async function remove(ownerId) {
    try {
      aad(ownerId);
      await deleteEnvelope(ownerId);
      return { ok: true };
    } catch (error) {
      return fail(error.message);
    }
  }

  return Object.freeze({ load, save, remove });
}

export const ENCRYPTED_MEMORY_PERSISTENCE = Object.freeze({
  version: ENVELOPE_VERSION,
  algorithm: ALGORITHM,
  keyBytes: KEY_BYTES,
  ivBytes: IV_BYTES,
  authTagBytes: TAG_BYTES,
  maxCiphertextBytes: MAX_CIPHERTEXT_BYTES
});
