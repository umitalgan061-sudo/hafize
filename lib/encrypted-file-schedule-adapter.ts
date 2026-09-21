import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const FORMAT_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DEFAULT_MAX_FILE_BYTES = 4 * 1024 * 1024;
const FORMAT_FIELDS = new Set(['version', 'algorithm', 'iv', 'tag', 'ciphertext']);

function normalizeKey(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new Error('INVALID_ENCRYPTED_SCHEDULE_ADAPTER:key');
  }
  const key = Buffer.from(value);
  if (key.length !== 32) throw new Error('INVALID_ENCRYPTED_SCHEDULE_ADAPTER:key');
  return key;
}

function normalizePath(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.includes('\0')) throw new Error('INVALID_ENCRYPTED_SCHEDULE_ADAPTER:filePath');
  return resolve(text);
}

function normalizeMaxBytes(value) {
  if (value == null) return DEFAULT_MAX_FILE_BYTES;
  if (!Number.isInteger(value) || value < 1024 || value > 64 * 1024 * 1024) {
    throw new Error('INVALID_ENCRYPTED_SCHEDULE_ADAPTER:maxFileBytes');
  }
  return value;
}

function parseEnvelope(text, maxFileBytes) {
  if (Buffer.byteLength(text, 'utf8') > maxFileBytes) throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  for (const key of Object.keys(payload)) {
    if (!FORMAT_FIELDS.has(key)) throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  }
  if (payload.version !== FORMAT_VERSION || payload.algorithm !== ALGORITHM) throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  for (const field of ['iv', 'tag', 'ciphertext']) {
    if (typeof payload[field] !== 'string' || !payload[field]) throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  }
  let iv;
  let tag;
  let ciphertext;
  try {
    iv = Buffer.from(payload.iv, 'base64');
    tag = Buffer.from(payload.tag, 'base64');
    ciphertext = Buffer.from(payload.ciphertext, 'base64');
  } catch {
    throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  }
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || ciphertext.length === 0) {
    throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  }
  return { iv, tag, ciphertext };
}

function encryptEnvelope(value, key) {
  let plaintext;
  try {
    plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  } catch {
    throw new Error('ENCRYPTED_SCHEDULE_SAVE_FAILED');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    version: FORMAT_VERSION,
    algorithm: ALGORITHM,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  });
}

function decryptEnvelope(text, key, maxFileBytes) {
  const { iv, tag, ciphertext } = parseEnvelope(text, maxFileBytes);
  let plaintext;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  }
  try {
    return JSON.parse(plaintext);
  } catch {
    throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
  }
}

export function createEncryptedFileScheduleAdapter({ filePath, key, maxFileBytes } = {}) {
  const target = normalizePath(filePath);
  const encryptionKey = normalizeKey(key);
  const maxBytes = normalizeMaxBytes(maxFileBytes);
  const directory = dirname(target);

  async function load() {
    let content;
    try {
      content = await readFile(target, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw new Error('ENCRYPTED_SCHEDULE_LOAD_FAILED');
    }
    return decryptEnvelope(content, encryptionKey, maxBytes);
  }

  async function save(value) {
    const content = encryptEnvelope(value, encryptionKey);
    if (Buffer.byteLength(content, 'utf8') > maxBytes) throw new Error('ENCRYPTED_SCHEDULE_SAVE_FAILED');
    const tempPath = `${target}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    let handle = null;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      handle = await open(tempPath, 'wx', 0o600);
      await handle.writeFile(content, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(tempPath, target);
      await chmod(target, 0o600);
    } catch {
      if (handle) {
        try { await handle.close(); } catch {}
      }
      try { await rm(tempPath, { force: true }); } catch {}
      throw new Error('ENCRYPTED_SCHEDULE_SAVE_FAILED');
    }
  }

  return Object.freeze({ load, save });
}
