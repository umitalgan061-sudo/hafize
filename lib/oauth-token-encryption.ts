import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 1 as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FIELDS = new Set(['version','algorithm','iv','tag','ciphertext']);

export interface OAuthTokenEnvelope {
  readonly version: typeof VERSION;
  readonly algorithm: typeof ALGORITHM;
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}
export interface OAuthTokenEncryptionOptions {
  readonly createIv?: (size: number) => Uint8Array | Buffer;
}

function keyBytes(value: unknown): Buffer {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) throw new Error('INVALID_OAUTH_TOKEN_ENCRYPTION:key');
  const key = Buffer.from(value);
  if (key.length !== 32) throw new Error('INVALID_OAUTH_TOKEN_ENCRYPTION:key');
  return key;
}

function decode(value: unknown, size?: number): Buffer {
  if (typeof value !== 'string' || !value) throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || (size && buffer.length !== size)) throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  return buffer;
}

export function encryptOAuthTokenRecord(record: unknown, key: Uint8Array | Buffer, { createIv = randomBytes }: OAuthTokenEncryptionOptions = {}): OAuthTokenEnvelope {
  const safeKey = keyBytes(key);
  if (typeof createIv !== 'function') throw new Error('INVALID_OAUTH_TOKEN_ENCRYPTION:createIv');
  let iv: Buffer;
  try { iv = Buffer.from(createIv(IV_BYTES)); } catch { throw new Error('OAUTH_TOKEN_ENCRYPT_FAILED'); }
  if (iv.length !== IV_BYTES) throw new Error('OAUTH_TOKEN_ENCRYPT_FAILED');
  let plaintext: Buffer;
  try { plaintext = Buffer.from(JSON.stringify(record), 'utf8'); } catch { throw new Error('OAUTH_TOKEN_ENCRYPT_FAILED'); }
  const cipher = createCipheriv(ALGORITHM, safeKey, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({ version: VERSION, algorithm: ALGORITHM, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}

export function decryptOAuthTokenRecord(envelope: unknown, key: Uint8Array | Buffer): unknown {
  const safeKey = keyBytes(key);
  if (!envelope || Array.isArray(envelope) || typeof envelope !== 'object') throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  const source = envelope as Record<string, unknown>;
  for (const field of Object.keys(source)) if (!FIELDS.has(field)) throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  if (source.version !== VERSION || source.algorithm !== ALGORITHM) throw new Error('OAUTH_TOKEN_DECRYPT_FAILED');
  try {
    const decipher = createDecipheriv(ALGORITHM, safeKey, decode(source.iv, IV_BYTES), { authTagLength: TAG_BYTES });
    decipher.setAuthTag(decode(source.tag, TAG_BYTES));
    return JSON.parse(Buffer.concat([decipher.update(decode(source.ciphertext)), decipher.final()]).toString('utf8')) as unknown;
  } catch { throw new Error('OAUTH_TOKEN_DECRYPT_FAILED'); }
}
