import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FIELDS = new Set(['version', 'algorithm', 'iv', 'tag', 'ciphertext']);

function keyBuffer(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new Error('INVALID_MEMORY_ENCRYPTION:key');
  }
  const key = Buffer.from(value);
  if (key.length !== 32) throw new Error('INVALID_MEMORY_ENCRYPTION:key');
  return key;
}

function decode(value, label) {
  if (typeof value !== 'string' || !value) throw new Error('MEMORY_DECRYPT_FAILED');
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length) throw new Error('MEMORY_DECRYPT_FAILED');
  if (label === 'iv' && buffer.length !== IV_BYTES) throw new Error('MEMORY_DECRYPT_FAILED');
  if (label === 'tag' && buffer.length !== TAG_BYTES) throw new Error('MEMORY_DECRYPT_FAILED');
  return buffer;
}

export function encryptPersonalMemorySnapshot(snapshot, key, { createIv = randomBytes } = {}) {
  const encryptionKey = keyBuffer(key);
  if (typeof createIv !== 'function') throw new Error('INVALID_MEMORY_ENCRYPTION:createIv');
  let iv;
  try { iv = Buffer.from(createIv(IV_BYTES)); } catch { throw new Error('MEMORY_ENCRYPT_FAILED'); }
  if (iv.length !== IV_BYTES) throw new Error('MEMORY_ENCRYPT_FAILED');
  let plaintext;
  try { plaintext = Buffer.from(JSON.stringify(snapshot), 'utf8'); } catch { throw new Error('MEMORY_ENCRYPT_FAILED'); }
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({
    version: VERSION,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  });
}

export function decryptPersonalMemorySnapshot(envelope, key) {
  const encryptionKey = keyBuffer(key);
  if (!envelope || Array.isArray(envelope) || typeof envelope !== 'object') throw new Error('MEMORY_DECRYPT_FAILED');
  for (const field of Object.keys(envelope)) if (!FIELDS.has(field)) throw new Error('MEMORY_DECRYPT_FAILED');
  if (envelope.version !== VERSION || envelope.algorithm !== ALGORITHM) throw new Error('MEMORY_DECRYPT_FAILED');
  const iv = decode(envelope.iv, 'iv');
  const tag = decode(envelope.tag, 'tag');
  const ciphertext = decode(envelope.ciphertext, 'ciphertext');
  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return JSON.parse(plaintext);
  } catch {
    throw new Error('MEMORY_DECRYPT_FAILED');
  }
}

export const PERSONAL_MEMORY_ENCRYPTION_VERSION = VERSION;
