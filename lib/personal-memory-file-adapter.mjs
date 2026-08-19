import { chmod, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const DEFAULT_MAX_FILE_BYTES = 4 * 1024 * 1024;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

function normalizePath(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.includes('\0')) throw new Error('INVALID_MEMORY_FILE_ADAPTER:filePath');
  return resolve(text);
}

function normalizeMaxBytes(value) {
  if (value == null) return DEFAULT_MAX_FILE_BYTES;
  if (!Number.isInteger(value) || value < 1024 || value > 64 * 1024 * 1024) {
    throw new Error('INVALID_MEMORY_FILE_ADAPTER:maxFileBytes');
  }
  return value;
}

function serialize(value, maxFileBytes) {
  let content;
  try {
    content = JSON.stringify(value);
  } catch {
    throw new Error('MEMORY_FILE_SAVE_FAILED');
  }
  if (Buffer.byteLength(content, 'utf8') > maxFileBytes) throw new Error('MEMORY_FILE_SAVE_FAILED');
  return content;
}

export function createPersonalMemoryFileAdapter({
  filePath,
  maxFileBytes,
  platform = process.platform
} = {}) {
  const target = normalizePath(filePath);
  const maxBytes = normalizeMaxBytes(maxFileBytes);
  const directory = dirname(target);
  const supportsPosixModes = platform !== 'win32';

  async function ensurePrivateDirectory() {
    await mkdir(directory, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
    if (supportsPosixModes) await chmod(directory, PRIVATE_DIRECTORY_MODE);
  }

  async function hardenExistingPermissions() {
    if (!supportsPosixModes) return;
    try {
      await chmod(directory, PRIVATE_DIRECTORY_MODE);
      await chmod(target, PRIVATE_FILE_MODE);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
  }

  async function load() {
    try {
      await hardenExistingPermissions();
    } catch {
      throw new Error('MEMORY_FILE_LOAD_FAILED');
    }

    let info;
    try {
      info = await stat(target);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw new Error('MEMORY_FILE_LOAD_FAILED');
    }
    if (!info.isFile() || info.size > maxBytes) throw new Error('MEMORY_FILE_LOAD_FAILED');

    let content;
    try {
      content = await readFile(target, 'utf8');
    } catch {
      throw new Error('MEMORY_FILE_LOAD_FAILED');
    }
    if (Buffer.byteLength(content, 'utf8') > maxBytes) throw new Error('MEMORY_FILE_LOAD_FAILED');
    try {
      const parsed = JSON.parse(content);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
      return parsed;
    } catch {
      throw new Error('MEMORY_FILE_LOAD_FAILED');
    }
  }

  async function save(value) {
    const content = serialize(value, maxBytes);
    const tempPath = `${target}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
    let handle = null;
    try {
      await ensurePrivateDirectory();
      handle = await open(tempPath, 'wx', PRIVATE_FILE_MODE);
      await handle.writeFile(content, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(tempPath, target);
      if (supportsPosixModes) await chmod(target, PRIVATE_FILE_MODE);
    } catch {
      if (handle) {
        try { await handle.close(); } catch {}
      }
      try { await rm(tempPath, { force: true }); } catch {}
      throw new Error('MEMORY_FILE_SAVE_FAILED');
    }
  }

  return Object.freeze({ load, save });
}

export const PERSONAL_MEMORY_FILE_MODES = Object.freeze({
  directory: PRIVATE_DIRECTORY_MODE,
  file: PRIVATE_FILE_MODE
});
