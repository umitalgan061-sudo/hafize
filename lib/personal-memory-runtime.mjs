import { resolve } from 'node:path';
import { createPersonalMemoryFileAdapter } from './personal-memory-file-adapter.mjs';
import { createPersonalMemoryPersistence } from './personal-memory-persistence.mjs';

const FILE_NAME = 'personal-memory.enc.json';

function decodeKey(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || !/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0) {
    throw new Error('INVALID_MEMORY_RUNTIME:key');
  }
  const key = Buffer.from(text, 'base64');
  if (key.length !== 32 || key.toString('base64') !== text) {
    throw new Error('INVALID_MEMORY_RUNTIME:key');
  }
  return key;
}

function storagePath(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.includes('\0')) throw new Error('INVALID_MEMORY_RUNTIME:storageDir');
  return resolve(text, FILE_NAME);
}

function maxFileBytes(value) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 64 * 1024 * 1024) {
    throw new Error('INVALID_MEMORY_RUNTIME:maxFileBytes');
  }
  return parsed;
}

export function createPersonalMemoryRuntime({
  env = process.env,
  storeOptions = {},
  createAdapter = createPersonalMemoryFileAdapter,
  createPersistence = createPersonalMemoryPersistence
} = {}) {
  if (!env || Array.isArray(env) || typeof env !== 'object') throw new Error('INVALID_MEMORY_RUNTIME:env');
  if (typeof createAdapter !== 'function') throw new Error('INVALID_MEMORY_RUNTIME:createAdapter');
  if (typeof createPersistence !== 'function') throw new Error('INVALID_MEMORY_RUNTIME:createPersistence');

  const key = decodeKey(env.HAFIZE_MEMORY_KEY_B64);
  const filePath = storagePath(env.HAFIZE_MEMORY_STORAGE_DIR);
  const limit = maxFileBytes(env.HAFIZE_MEMORY_MAX_FILE_BYTES);
  const adapter = createAdapter({ filePath, ...(limit == null ? {} : { maxFileBytes: limit }) });
  const persistence = createPersistence({ adapter, key, storeOptions });

  return Object.freeze({
    open: (...args) => persistence.open(...args),
    snapshot: (...args) => persistence.snapshot(...args),
    read: (...args) => persistence.read(...args),
    readForContext: (...args) => persistence.readForContext(...args),
    write: (...args) => persistence.write(...args),
    remove: (...args) => persistence.remove(...args)
  });
}

export const PERSONAL_MEMORY_FILE_NAME = FILE_NAME;
