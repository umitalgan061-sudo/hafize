import { isAbsolute } from 'node:path';

const FILE_ENV = 'HAFIZE_MEMORY_STORAGE_FILE';
const KEY_ENV = 'HAFIZE_MEMORY_STORAGE_KEY_BASE64';
const MAX_PATH_LENGTH = 4096;

function invalid() {
  throw new Error('INVALID_ENCRYPTED_MEMORY_CONFIG');
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeKey(value) {
  const text = clean(value);
  if (!text || /\s/.test(text) || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) invalid();
  let key;
  try { key = Buffer.from(text, 'base64url'); } catch { invalid(); }
  if (key.length !== 32) invalid();
  const canonical = text.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (canonical !== key.toString('base64url')) invalid();
  return key;
}

function filePath(value) {
  const path = clean(value);
  if (!path || path.length > MAX_PATH_LENGTH || path.includes('\0') || !isAbsolute(path)) invalid();
  return path;
}

export function readEncryptedMemoryStorageConfig({ env = process.env } = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') invalid();
  const file = clean(env[FILE_ENV]);
  const keyText = clean(env[KEY_ENV]);
  if (!file && !keyText) return null;
  if (!file || !keyText) invalid();

  const key = decodeKey(keyText);
  const config = { filePath: filePath(file) };
  Object.defineProperty(config, 'key', {
    get: () => Buffer.from(key),
    enumerable: false,
    configurable: false
  });
  return Object.freeze(config);
}

export const ENCRYPTED_MEMORY_STORAGE_ENV = Object.freeze({ file: FILE_ENV, keyBase64: KEY_ENV });
