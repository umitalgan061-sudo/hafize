import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPersonalMemoryFileAdapter } from '../lib/personal-memory-file-adapter.mjs';

const root = await mkdtemp(join(tmpdir(), 'hafize-memory-file-'));
try {
  const filePath = join(root, 'nested', 'memory.enc.json');
  const adapter = createPersonalMemoryFileAdapter({ filePath, maxFileBytes: 4096 });

  assert.equal(await adapter.load(), null);
  const envelope = {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: 'AAAAAAAAAAAAAAAA',
    tag: 'BBBBBBBBBBBBBBBBBBBBBB==',
    ciphertext: 'CCCC'
  };
  await adapter.save(envelope);
  assert.deepEqual(await adapter.load(), envelope);
  assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), envelope);

  if (process.platform !== 'win32') {
    assert.equal((await stat(filePath)).mode & 0o777, 0o600);
  }

  await adapter.save({ ...envelope, ciphertext: 'DDDD' });
  assert.equal((await adapter.load()).ciphertext, 'DDDD');

  await writeFile(filePath, '{broken', 'utf8');
  await assert.rejects(() => adapter.load(), /MEMORY_FILE_LOAD_FAILED/);

  await writeFile(filePath, 'x'.repeat(5000), 'utf8');
  await assert.rejects(() => adapter.load(), /MEMORY_FILE_LOAD_FAILED/);
  await assert.rejects(
    () => adapter.save({ ciphertext: 'x'.repeat(5000) }),
    /MEMORY_FILE_SAVE_FAILED/
  );

  assert.throws(
    () => createPersonalMemoryFileAdapter({ filePath: '' }),
    /INVALID_MEMORY_FILE_ADAPTER:filePath/
  );
  assert.throws(
    () => createPersonalMemoryFileAdapter({ filePath, maxFileBytes: 100 }),
    /INVALID_MEMORY_FILE_ADAPTER:maxFileBytes/
  );

  const dirTarget = join(root, 'directory-target');
  await mkdir(dirTarget);
  const directoryAdapter = createPersonalMemoryFileAdapter({ filePath: dirTarget });
  await assert.rejects(() => directoryAdapter.load(), /MEMORY_FILE_LOAD_FAILED/);

  console.log('personal memory file adapter tests passed');
} finally {
  await rm(root, { recursive: true, force: true });
}
