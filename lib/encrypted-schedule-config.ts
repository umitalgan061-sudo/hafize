import { isAbsolute } from 'node:path';

const FILE_ENV = 'HAFIZE_SCHEDULE_STORAGE_FILE';
const KEY_ENV = 'HAFIZE_SCHEDULE_STORAGE_KEY_BASE64';
const MAX_PATH_LENGTH = 4096;

export interface EncryptedScheduleStorageConfig {
  readonly filePath: string;
  readonly key: Buffer;
}
const invalid = (): never => { throw new Error('INVALID_ENCRYPTED_SCHEDULE_CONFIG'); };
const cleanEnvValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

function decodeKey(value: unknown): Buffer {
  const text = cleanEnvValue(value);
  if (!text || /\s/.test(text) || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) invalid();
  let key: Buffer;
  try { key = Buffer.from(text, 'base64url'); } catch { invalid(); }
  if (key.length !== 32) invalid();
  const canonicalInput = text.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  if (canonicalInput !== key.toString('base64url')) invalid();
  return key;
}

function cleanFilePath(value: unknown): string {
  const filePath = cleanEnvValue(value);
  if (!filePath || filePath.length > MAX_PATH_LENGTH || filePath.includes('\0') || !isAbsolute(filePath)) invalid();
  return filePath;
}

export function readEncryptedScheduleStorageConfig({ env = process.env }: { env?: Record<string, string | undefined> } = {}): EncryptedScheduleStorageConfig | null {
  if (!env || Array.isArray(env) || typeof env !== 'object') invalid();
  const fileValue = cleanEnvValue(env[FILE_ENV]);
  const keyValue = cleanEnvValue(env[KEY_ENV]);
  if (!fileValue && !keyValue) return null;
  if (!fileValue || !keyValue) invalid();
  const config = { filePath: cleanFilePath(fileValue), key: Buffer.alloc(32) };
  const decoded = decodeKey(keyValue);
  Object.defineProperty(config, 'key', {
    get: () => Buffer.from(decoded),
    enumerable: false,
    configurable: false
  });
  return Object.freeze(config);
}

export const ENCRYPTED_SCHEDULE_STORAGE_ENV = Object.freeze({ file: FILE_ENV, keyBase64: KEY_ENV });
