import assert from 'node:assert/strict';
import { decryptPersonalMemorySnapshot, encryptPersonalMemorySnapshot } from '../lib/personal-memory-encryption.mjs';

const key = Buffer.alloc(32, 7);
const snapshot = { schemaVersion: 1, entries: [{ memoryId: 'memory_testid01', content: 'Ankara' }] };
const envelope = encryptPersonalMemorySnapshot(snapshot, key, { createIv: () => Buffer.alloc(12, 3) });
assert.equal(envelope.algorithm, 'aes-256-gcm');
assert.deepEqual(decryptPersonalMemorySnapshot(envelope, key), snapshot);
assert.equal(JSON.stringify(envelope).includes('Ankara'), false);
assert.throws(() => decryptPersonalMemorySnapshot(envelope, Buffer.alloc(32, 8)), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => decryptPersonalMemorySnapshot({ ...envelope, extra: true }, key), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => decryptPersonalMemorySnapshot({ ...envelope, iv: Buffer.alloc(8).toString('base64') }, key), /MEMORY_DECRYPT_FAILED/);
assert.throws(() => encryptPersonalMemorySnapshot(snapshot, Buffer.alloc(31)), /INVALID_MEMORY_ENCRYPTION:key/);
assert.throws(() => encryptPersonalMemorySnapshot(snapshot, key, { createIv: () => Buffer.alloc(8) }), /MEMORY_ENCRYPT_FAILED/);
console.log('personal memory encryption tests passed');
