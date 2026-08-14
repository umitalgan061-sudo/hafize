import { isAbsolute } from 'node:path';

const FILE_ENV = 'HAFIZE_SCHEDULE_STORAGE_FILE';
const KEY_ENV = 'HAFIZE_SCHEDULE_STORAGE_KEY_BASE64';
const MAX_PATH_LENGTH = 4096;

function invalid() {
  throw new Error('INVALID_ENCRYPTED_SCHEDULE_CONFIG');
}

function cleanEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeKey(value) {
  const text = cleanEnvValue(value);
  if (!text || /\s/.test(text) || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) invalid();

  let key;
  try {
    key = Buffer.from(text, 'base64url');
  } catch {
    invalid();
  }
  if (key.length !== 32) invalid();

  const canonicalInput = text.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (canonicalInput !== key.toString('base64url')) invalid();
  return key;
}

function cleanFilePath(value) {
  const filePath = cleanEnvValue(value);
  if (!filePath || filePath.length > MAX_PATH_LENGTH || filePath.includes('\0') || !isAbsolute(filePath)) invalid();
  return filePath;
}

export function readEncryptedScheduleStorageConfig({ env = process.env } = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') invalid();

  const fileValue = cleanEnvValue(env[FILE_ENV]);
  const keyValue = cleanEnvValue(env[KEY_ENV]);
  if (!fileValue && !keyValue) return null;
  if (!fileValue || !keyValue) invalid();

  const config = { filePath: cleanFilePath(fileValue) };
  const key = decodeKey(keyValue);
  Object.defineProperty(config, 'key', {
    get: () => Buffer.from(key),
    enumerable: false,
    configurable: false
  });
  return Object.freeze(config);
}

export const ENCRYPTED_SCHEDULE_STORAGE_ENV = Object.freeze({
  file: FILE_ENV,
  keyBase64: KEY_ENV
});
