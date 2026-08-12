import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createEncryptedFileScheduleAdapter } from '../lib/encrypted-file-schedule-adapter.mjs';

const dir = await mkdtemp(join(tmpdir(), 'hafize-schedule-'));
const filePath = join(dir, 'schedule.enc.json');
const key = Buffer.alloc(32, 7);
const otherKey = Buffer.alloc(32, 8);
const adapter = createEncryptedFileScheduleAdapter({ filePath, key });

assert.equal(await adapter.load(), null);

const envelope = {
  schemaVersion: 1,
  snapshot: {
    entries: [{ scheduleId: 'schedule_1', task: 'Gizli görev metni' }]
  }
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
const fileStat = await stat(filePath);
assert.equal(fileStat.mode & 0o777, 0o600);

const wrongKeyAdapter = createEncryptedFileScheduleAdapter({ filePath, key: otherKey });
await assert.rejects(() => wrongKeyAdapter.load(), /ENCRYPTED_SCHEDULE_LOAD_FAILED/);

const tampered = JSON.parse(raw);
tampered.ciphertext = `${tampered.ciphertext.slice(0, -2)}AA`;
await writeFile(filePath, JSON.stringify(tampered), 'utf8');
await assert.rejects(() => adapter.load(), /ENCRYPTED_SCHEDULE_LOAD_FAILED/);

await writeFile(filePath, JSON.stringify({ ...encoded, secret: 'nope' }), 'utf8');
await assert.rejects(() => adapter.load(), /ENCRYPTED_SCHEDULE_LOAD_FAILED/);

assert.throws(
  () => createEncryptedFileScheduleAdapter({ filePath, key: Buffer.alloc(16) }),
  /INVALID_ENCRYPTED_SCHEDULE_ADAPTER:key/
);
assert.throws(
  () => createEncryptedFileScheduleAdapter({ filePath: '', key }),
  /INVALID_ENCRYPTED_SCHEDULE_ADAPTER:filePath/
);
assert.throws(
  () => createEncryptedFileScheduleAdapter({ filePath, key, maxFileBytes: 100 }),
  /INVALID_ENCRYPTED_SCHEDULE_ADAPTER:maxFileBytes/
);

console.log('encrypted file schedule adapter tests passed');
