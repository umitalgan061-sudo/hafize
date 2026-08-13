import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FIELDS = new Set(['version', 'algorithm', 'iv', 'tag', 'ciphertext']);

function keyBytes(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) throw new Error('INVALID_OAUTH_TOKEN_ENCRYPTION:key');
  const key = Buffer.from(value);
  if (key.length !== 32) throw new Error('INVALID_OAUTH_TOKEN_ENCRYPTION:key');
  return key;
}

function decode(value, size) {
  if (typeof value !== 'string' || !value) throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || (size && buffer.length !== size)) throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  return buffer;
}

export function encryptOAuthTokenRecord(record, key, { createIv = randomBytes } = {}) {
  const safeKey = keyBytes(key);
  if (typeof createIv !== 'function') throw new Error('INVALID_OAUTH_TOKEN_ENCRYPTION:createIv');
  let iv;
  try { iv = Buffer.from(createIv(IV_BYTES)); } catch { throw new Error('OAUTH_TOKEN_ENCRYPT_FAILED'); }
  if (iv.length !== IV_BYTES) throw new Error('OAUTH_TOKEN_ENCRYPT_FAILED');
  let plaintext;
  try { plaintext = Buffer.from(JSON.stringify(record), 'utf8'); } catch { throw new Error('OAUTH_TOKEN_ENCRYPT_FAILED'); }
  const cipher = createCipheriv(ALGORITHM, safeKey, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({ version: VERSION, algorithm: ALGORITHM, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}

export function decryptOAuthTokenRecord(envelope, key) {
  const safeKey = keyBytes(key);
  if (!envelope || Array.isArray(envelope) || typeof envelope !== 'object') throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  for (const field of Object.keys(envelope)) if (!FIELDS.has(field)) throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  if (envelope.version !== VERSION || envelope.algorithm !== ALGORITHM) throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  try {
    const decipher = createDecipheriv(ALGORITHM, safeKey, decode(envelope.iv, IV_BYTES), { authTagLength: TAG_BYTES });
    decipher.setAuthTag(decode(envelope.tag, TAG_BYTES));
    return JSON.parse(Buffer.concat([decipher.update(decode(envelope.ciphertext)), decipher.final()]).toString('utf8'));
  } catch {
    throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  }
}
