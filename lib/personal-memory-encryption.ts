import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 1 as const;
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const FIELDS = new Set(['version','algorithm','iv','tag','ciphertext']);

export interface PersonalMemoryEnvelope {
  readonly version: typeof VERSION;
  readonly algorithm: typeof ALGORITHM;
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}

function keyBuffer(value: unknown): Buffer {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) throw new Error('INVALID_MEMORY_ENCRYPTION:key');
  const key = Buffer.from(value);
  if (key.length !== 32) throw new Error('INVALID_MEMORY_ENCRYPTION:key');
  return key;
}

function decode(value: unknown, label: string): Buffer {
  if (typeof value !== 'string' || !value) throw new Error('MEMORY_DECRYPT_FAILED');
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || (label === 'iv' && buffer.length !== IV_BYTES) || (label === 'tag' && buffer.length !== TAG_BYTES)) throw new Error('MEMORY_DECRYPT_FAILED');
  return buffer;
}

export function encryptPersonalMemorySnapshot(snapshot: unknown, key: Uint8Array | Buffer, { createIv = randomBytes }: { readonly createIv?: (size: number) => Uint8Array | Buffer } = {}): PersonalMemoryEnvelope {
  const encryptionKey = keyBuffer(key);
  if (typeof createIv !== 'function') throw new Error('INVALID_MEMORY_ENCRYPTION:createIv');
  let iv: Buffer;
  try { iv = Buffer.from(createIv(IV_BYTES)); } catch { throw new Error('MEMORY_ENCRYPT_FAILED'); }
  if (iv.length !== IV_BYTES) throw new Error('MEMORY_ENCRYPT_FAILED');
  let plaintext: Buffer;
  try { plaintext = Buffer.from(JSON.stringify(snapshot), 'utf8'); } catch { throw new Error('MEMORY_ENCRYPT_FAILED'); }
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({ version: VERSION, algorithm: ALGORITHM, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}

export function decryptPersonalMemorySnapshot(envelope: unknown, key: Uint8Array | Buffer): unknown {
  const encryptionKey = keyBuffer(key);
  if (!envelope || Array.isArray(envelope) || typeof envelope !== 'object') throw new Error('MEMORY_DECRYPT_FAILED');
  const source = envelope as Record<string, unknown>;
  for (const field of Object.keys(source)) if (!FIELDS.has(field)) throw new Error('MEMORY_DECRYPT_FAILED');
  if (source.version !== VERSION || source.algorithm !== ALGORITHM) throw new Error('MEMORY_DECRYPT_FAILED');
  const iv = decode(source.iv, 'iv');
  const tag = decode(source.tag, 'tag');
  const ciphertext = decode(source.ciphertext, 'ciphertext');
  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as unknown;
  } catch { throw new Error('MEMORY_DECRYPT_FAILED'); }
}

export const PERSONAL_MEMORY_ENCRYPTION_VERSION = VERSION;
