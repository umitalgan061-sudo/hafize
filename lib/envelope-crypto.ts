// Envelope encryption for data at rest. A master key (HAFIZE_MASTER_KEY or data/master.key) only
// wraps per-owner data keys; each owner's records are encrypted with that owner's own AES-256-GCM
// key. Full-text search runs over keyed hashes of tokens, so the index never holds plaintext.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

const VERSION = 'v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;

export class EnvelopeCryptoError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'EnvelopeCryptoError'; this.code = code; }
}

function parseKey(value: string): Buffer | null {
  const text = value.trim();
  if (/^[0-9a-f]{64}$/i.test(text)) return Buffer.from(text, 'hex');
  const decoded = Buffer.from(text, 'base64');
  return decoded.length === KEY_BYTES ? decoded : null;
}

/** Returns the master key from the environment, or from keyFile (created with a fresh key when missing). */
export function loadMasterKey({ envValue, keyFile }: { readonly envValue?: string | undefined; readonly keyFile: string }): { key: Buffer; source: 'env' | 'file' | 'generated' } {
  if (envValue && envValue.trim()) {
    const key = parseKey(envValue);
    if (!key) throw new EnvelopeCryptoError('INVALID_MASTER_KEY');
    return { key, source: 'env' };
  }
  if (existsSync(keyFile)) {
    const key = parseKey(readFileSync(keyFile, 'utf8'));
    if (!key) throw new EnvelopeCryptoError('INVALID_MASTER_KEY_FILE');
    return { key, source: 'file' };
  }
  const key = randomBytes(KEY_BYTES);
  mkdirSync(dirname(keyFile), { recursive: true });
  writeFileSync(keyFile, key.toString('base64') + '\n', { mode: 0o600, flag: 'wx' });
  return { key, source: 'generated' };
}

function seal(key: Buffer, plaintext: Buffer, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
}

function open(key: Buffer, sealed: string, aad: string): Buffer {
  const parts = typeof sealed === 'string' ? sealed.split(':') : [];
  if (parts.length !== 4 || parts[0] !== VERSION) throw new EnvelopeCryptoError('INVALID_CIPHERTEXT');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1]!, 'base64'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(parts[2]!, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3]!, 'base64')), decipher.final()]);
  } catch {
    throw new EnvelopeCryptoError('DECRYPTION_FAILED');
  }
}

export interface OwnerCipher {
  encrypt(plaintext: string): string;
  decrypt(sealed: string): string;
  encryptVector(vector: readonly number[]): string;
  decryptVector(sealed: string): Float32Array;
  /** Keyed, deterministic hash of a search token (searchable without revealing the token). */
  tokenHash(token: string): string;
}

export function createEnvelopeCrypto({ db, masterKey, now = () => Date.now() }: { readonly db: DatabaseSync; readonly masterKey: Buffer; readonly now?: () => number }) {
  if (!Buffer.isBuffer(masterKey) || masterKey.length !== KEY_BYTES) throw new EnvelopeCryptoError('INVALID_MASTER_KEY');
  const cache = new Map<string, OwnerCipher>();
  const selectKey = db.prepare('SELECT wrapped_key FROM owner_keys WHERE owner_id = ?');
  const insertKey = db.prepare('INSERT OR IGNORE INTO owner_keys (owner_id, wrapped_key, created_at) VALUES (?, ?, ?)');

  function dataKey(ownerId: string): Buffer {
    let row = selectKey.get(ownerId) as { wrapped_key: string } | undefined;
    if (!row) {
      insertKey.run(ownerId, seal(masterKey, randomBytes(KEY_BYTES), `owner-key:${ownerId}`), now());
      row = selectKey.get(ownerId) as { wrapped_key: string };
    }
    return open(masterKey, row.wrapped_key, `owner-key:${ownerId}`);
  }

  function forOwner(ownerId: string): OwnerCipher {
    if (typeof ownerId !== 'string' || !ownerId) throw new EnvelopeCryptoError('INVALID_OWNER');
    const cached = cache.get(ownerId);
    if (cached) return cached;
    const key = dataKey(ownerId);
    const hashKey = Buffer.from(hkdfSync('sha256', key, Buffer.alloc(0), 'hafize-search-tokens', KEY_BYTES));
    const aad = `owner:${ownerId}`;
    const cipher: OwnerCipher = Object.freeze({
      encrypt: (plaintext: string) => seal(key, Buffer.from(String(plaintext), 'utf8'), aad),
      decrypt: (sealed: string) => open(key, sealed, aad).toString('utf8'),
      encryptVector: (vector: readonly number[]) => seal(key, Buffer.from(Float32Array.from(vector).buffer), aad + ':vec'),
      decryptVector: (sealed: string) => {
        const bytes = open(key, sealed, aad + ':vec');
        return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      },
      tokenHash: (token: string) => createHmac('sha256', hashKey).update(token).digest('base64url').slice(0, 16)
    });
    cache.set(ownerId, cipher);
    return cipher;
  }

  function forgetOwner(ownerId: string): void {
    cache.delete(ownerId);
    db.prepare('DELETE FROM owner_keys WHERE owner_id = ?').run(ownerId);
  }

  return Object.freeze({ forOwner, forgetOwner });
}
export type EnvelopeCrypto = ReturnType<typeof createEnvelopeCrypto>;
