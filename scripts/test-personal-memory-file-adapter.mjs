import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createPersonalMemoryFileAdapter,
  PERSONAL_MEMORY_FILE_MODES
} from '../lib/personal-memory-file-adapter.mjs';

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
    assert.equal((await stat(join(root, 'nested'))).mode & 0o777, PERSONAL_MEMORY_FILE_MODES.directory);
    assert.equal((await stat(filePath)).mode & 0o777, PERSONAL_MEMORY_FILE_MODES.file);

    await chmod(join(root, 'nested'), 0o755);
    await chmod(filePath, 0o644);
    assert.deepEqual(await adapter.load(), envelope, 'load should preserve valid encrypted data while repairing legacy modes');
    assert.equal((await stat(join(root, 'nested'))).mode & 0o777, PERSONAL_MEMORY_FILE_MODES.directory);
    assert.equal((await stat(filePath)).mode & 0o777, PERSONAL_MEMORY_FILE_MODES.file);

    await chmod(join(root, 'nested'), 0o755);
    await adapter.save({ ...envelope, ciphertext: 'EEEE' });
    assert.equal((await stat(join(root, 'nested'))).mode & 0o777, PERSONAL_MEMORY_FILE_MODES.directory);
    assert.equal((await stat(filePath)).mode & 0o777, PERSONAL_MEMORY_FILE_MODES.file);
    assert.equal((await adapter.load()).ciphertext, 'EEEE');
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

  const simulatedWindowsPath = join(root, 'windows', 'memory.json');
  const simulatedWindowsAdapter = createPersonalMemoryFileAdapter({
    filePath: simulatedWindowsPath,
    platform: 'win32'
  });
  await simulatedWindowsAdapter.save(envelope);
  assert.deepEqual(await simulatedWindowsAdapter.load(), envelope);

  console.log('personal memory file adapter tests passed');
} finally {
  await rm(root, { recursive: true, force: true });
}
