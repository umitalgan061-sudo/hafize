import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  createEncryptedFileScheduleAdapter,
  ENCRYPTED_SCHEDULE_FILE_MODES
} from '../lib/encrypted-file-schedule-adapter.mjs';

const dir = await mkdtemp(join(tmpdir(), 'hafize-schedule-'));
const filePath = join(dir, 'nested', 'schedule.enc.json');
const key = Buffer.alloc(32, 7);
const otherKey = Buffer.alloc(32, 8);
const adapter = createEncryptedFileScheduleAdapter({ filePath, key });

assert.equal(await adapter.load(), null);

const envelope = {
  schemaVersion: 1,
  snapshot: { entries: [{ scheduleId: 'schedule_1', task: 'Gizli görev metni' }] }
};
await adapter.save(envelope);

const raw = await readFile(filePath, 'utf8');
assert.equal(raw.includes('Gizli görev metni'), false);
assert.equal(raw.includes('schedule_1'), false);
const encoded = JSON.parse(raw);
assert.equal(encoded.version, 1);
assert.equal(encoded.algorithm, 'aes-256-gcm');
assert.equal(typeof encoded.iv, 'string');
assert.equal(typeof encoded.tag, 'string');
assert.equal(typeof encoded.ciphertext, 'string');

assert.deepEqual(await adapter.load(), envelope);
if (process.platform !== 'win32') {
  assert.equal((await stat(dirname(filePath))).mode & 0o777, ENCRYPTED_SCHEDULE_FILE_MODES.directory);
  assert.equal((await stat(filePath)).mode & 0o777, ENCRYPTED_SCHEDULE_FILE_MODES.file);

  await chmod(dirname(filePath), 0o755);
  await chmod(filePath, 0o644);
  assert.deepEqual(await adapter.load(), envelope);
  assert.equal((await stat(dirname(filePath))).mode & 0o777, ENCRYPTED_SCHEDULE_FILE_MODES.directory);
  assert.equal((await stat(filePath)).mode & 0o777, ENCRYPTED_SCHEDULE_FILE_MODES.file);

  await chmod(dirname(filePath), 0o755);
  await adapter.save(envelope);
  assert.equal((await stat(dirname(filePath))).mode & 0o777, ENCRYPTED_SCHEDULE_FILE_MODES.directory);
  assert.equal((await stat(filePath)).mode & 0o777, ENCRYPTED_SCHEDULE_FILE_MODES.file);
}

const wrongKeyAdapter = createEncryptedFileScheduleAdapter({ filePath, key: otherKey });
await assert.rejects(() => wrongKeyAdapter.load(), /ENCRYPTED_SCHEDULE_LOAD_FAILED/);

const tampered = JSON.parse(await readFile(filePath, 'utf8'));
tampered.ciphertext = `${tampered.ciphertext.slice(0, -2)}AA`;
await writeFile(filePath, JSON.stringify(tampered), 'utf8');
await assert.rejects(() => adapter.load(), /ENCRYPTED_SCHEDULE_LOAD_FAILED/);

await writeFile(filePath, JSON.stringify({ ...encoded, secret: 'nope' }), 'utf8');
await assert.rejects(() => adapter.load(), /ENCRYPTED_SCHEDULE_LOAD_FAILED/);

assert.throws(() => createEncryptedFileScheduleAdapter({ filePath, key: Buffer.alloc(16) }), /INVALID_ENCRYPTED_SCHEDULE_ADAPTER:key/);
assert.throws(() => createEncryptedFileScheduleAdapter({ filePath: '', key }), /INVALID_ENCRYPTED_SCHEDULE_ADAPTER:filePath/);
assert.throws(
  () => createEncryptedFileScheduleAdapter({ filePath, key, maxFileBytes: 100 }),
  /INVALID_ENCRYPTED_SCHEDULE_ADAPTER:maxFileBytes/
);

const simulatedWindowsPath = join(dir, 'windows', 'schedule.enc.json');
const simulatedWindows = createEncryptedFileScheduleAdapter({ filePath: simulatedWindowsPath, key, platform: 'win32' });
await simulatedWindows.save(envelope);
assert.deepEqual(await simulatedWindows.load(), envelope);

console.log('encrypted file schedule adapter tests passed');
