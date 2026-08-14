import assert from 'node:assert/strict';
import { decryptPersonalMemorySnapshot, encryptPersonalMemorySnapshot } from '../lib/personal-memory-encryption.mjs';
import { createPersonalMemoryPersistence } from '../lib/personal-memory-persistence.mjs';

const key = Buffer.alloc(32, 7);
const snapshot = { schemaVersion: 1, entries: [{ memoryId: 'memory_testid01', content: 'Ankara' }] };
const envelope = encryptPersonalMemorySnapshot(snapshot, key, { createIv: () => Buffer.alloc(12, 3) });
assert.equal(envelope.version, 1);
assert.equal(envelope.algorithm, 'aes-256-gcm');
assert.deepEqual(decryptPersonalMemorySnapshot(envelope, key), snapshot);
assert.equal(JSON.stringify(envelope).includes('Ankara'), false);
assert.throws(() => decryptPersonalMemorySnapshot(envelope, Buffer.alloc(32, 8)), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => decryptPersonalMemorySnapshot({ ...envelope, extra: true }, key), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => decryptPersonalMemorySnapshot({ ...envelope, version: 2 }, key), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => decryptPersonalMemorySnapshot({ ...envelope, algorithm: 'aes-128-gcm' }, key), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => decryptPersonalMemorySnapshot({ ...envelope, iv: Buffer.alloc(8).toString('base64') }, key), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => decryptPersonalMemorySnapshot({ ...envelope, tag: Buffer.alloc(8).toString('base64') }, key), /MEMORY_DECRYPT_FAILED/);
const tampered = Buffer.from(envelope.ciphertext, 'base64');
tampered[0] ^= 1;
assert.throws(() => decryptPersonalMemorySnapshot({ ...envelope, ciphertext: tampered.toString('base64') }, key), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => encryptPersonalMemorySnapshot(snapshot, Buffer.alloc(31)), /INVALID_MEMORY_ENCRYPTION:key/);
assert.throws(() => encryptPersonalMemorySnapshot(snapshot, key, { createIv: null }), /INVALID_MEMORY_ENCRYPTION:createIv/);
assert.throws(() => encryptPersonalMemorySnapshot(snapshot, key, { createIv: () => Buffer.alloc(8) }), /MEMORY_ENCRYPT_FAILED/);

let stored = null;
let id = 0;
const adapter = {
  load: async () => stored,
  save: async (value) => { stored = structuredClone(value); }
};
const storeOptions = {
  createId: () => `persist${String(++id).padStart(4, '0')}`,
  now: () => new Date('2026-08-13T15:00:00.000Z')
};
const memory = createPersonalMemoryPersistence({ adapter, key, storeOptions });
assert.deepEqual(await memory.open(), { schemaVersion: 1, entries: [] });
const first = await memory.write({
  ownerId: 'owner-a', kind: 'preference', content: 'Tenis oynamayı severim.',
  sourceType: 'user_statement', sourceRef: 'conversation-9', sensitivity: 'personal', explicitUserIntent: true
});
assert.equal(first.ok, true);
assert.equal(JSON.stringify(stored).includes('Tenis'), false);

const restarted = createPersonalMemoryPersistence({ adapter, key, storeOptions });
await restarted.open();
const context = restarted.readForContext({ ownerId: 'owner-a', query: 'tenis' });
assert.equal(context.records[0].sourceRef, 'conversation-9');
assert.equal('ownerId' in context.records[0], false);
const concurrent = await Promise.all([
  restarted.write({ ownerId: 'owner-a', kind: 'note', content: 'Birinci', sourceType: 'user_note', sensitivity: 'personal', explicitUserIntent: true }),
  restarted.write({ ownerId: 'owner-a', kind: 'note', content: 'İkinci', sourceType: 'user_note', sensitivity: 'personal', explicitUserIntent: true })
]);
assert.equal(concurrent.every((result) => result.ok), true);
const concurrentRestart = createPersonalMemoryPersistence({ adapter, key, storeOptions });
await concurrentRestart.open();
assert.equal(concurrentRestart.snapshot().entries.length, 3);

const wrongKey = createPersonalMemoryPersistence({ adapter, key: Buffer.alloc(32, 12), storeOptions });
await assert.rejects(() => wrongKey.open(), /MEMORY_PERSISTENCE_LOAD_FAILED/);
const before = concurrentRestart.snapshot();
const failing = createPersonalMemoryPersistence({
  adapter: { load: async () => stored, save: async () => { throw new Error('storage'); } }, key, storeOptions
});
await failing.open();
const failed = await failing.write({
  ownerId: 'owner-a', kind: 'note', content: 'Kaydedilmemeli', sourceType: 'user_note',
  sensitivity: 'personal', explicitUserIntent: true
});
assert.deepEqual(failed, { ok: false, error: 'MEMORY_PERSISTENCE_SAVE_FAILED' });
assert.deepEqual(failing.snapshot(), before);
const removed = await concurrentRestart.remove({ ownerId: 'owner-a', memoryId: first.record.memoryId, exactMatch: true });
assert.equal(removed.ok, true);
const afterDelete = createPersonalMemoryPersistence({ adapter, key, storeOptions });
await afterDelete.open();
assert.equal(afterDelete.read({ ownerId: 'owner-a', query: 'tenis' }).records.length, 0);
assert.throws(() => createPersonalMemoryPersistence({ adapter, key: Buffer.alloc(31) }), /INVALID_MEMORY_PERSISTENCE:key/);
assert.throws(() => createPersonalMemoryPersistence({ adapter: {}, key }), /INVALID_MEMORY_PERSISTENCE:adapter/);
console.log('personal memory encryption and persistence tests passed');
