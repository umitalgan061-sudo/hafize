import assert from 'node:assert/strict';
import {
  createEncryptedMemoryPersistence,
  decryptMemorySnapshot,
  encryptMemorySnapshot,
  ENCRYPTED_MEMORY_PERSISTENCE
} from '../lib/encrypted-memory-persistence.mjs';

const key = Buffer.alloc(32, 7);
const otherKey = Buffer.alloc(32, 8);
const snapshot = {
  schemaVersion: 1,
  entries: [
    {
      memoryId: 'memory_testid0001',
      ownerId: 'user-alice',
      kind: 'preference',
      content: 'Akşamları tenis oynamayı seviyorum.',
      sourceType: 'user_statement',
      sourceRef: 'conversation-1',
      sensitivity: 'personal',
      createdAt: '2026-08-25T12:00:00.000Z',
      updatedAt: null
    }
  ]
};

const fixedIv = Buffer.from('000102030405060708090a0b', 'hex');
const encrypted = encryptMemorySnapshot({
  ownerId: 'user-alice',
  snapshot,
  key,
  random: (size) => {
    assert.equal(size, ENCRYPTED_MEMORY_PERSISTENCE.ivBytes);
    return fixedIv;
  }
});
assert.equal(encrypted.ok, true);
assert.equal(encrypted.envelope.version, 1);
assert.equal(encrypted.envelope.algorithm, 'aes-256-gcm');
assert.equal(encrypted.envelope.iv, fixedIv.toString('base64'));
assert.equal(typeof encrypted.envelope.tag, 'string');
assert.equal(typeof encrypted.envelope.ciphertext, 'string');
assert.equal(JSON.stringify(encrypted.envelope).includes('tenis'), false);
assert.equal(JSON.stringify(encrypted.envelope).includes('user-alice'), false);

const decrypted = decryptMemorySnapshot({
  ownerId: 'user-alice',
  envelope: encrypted.envelope,
  key
});
assert.deepEqual(decrypted, { ok: true, snapshot });

assert.deepEqual(
  decryptMemorySnapshot({ ownerId: 'user-bob', envelope: encrypted.envelope, key }),
  { ok: false, error: 'MEMORY_DECRYPT_FAILED' }
);
assert.deepEqual(
  decryptMemorySnapshot({ ownerId: 'user-alice', envelope: encrypted.envelope, key: otherKey }),
  { ok: false, error: 'MEMORY_DECRYPT_FAILED' }
);

const tampered = {
  ...encrypted.envelope,
  ciphertext: Buffer.from('tampered').toString('base64')
};
assert.deepEqual(
  decryptMemorySnapshot({ ownerId: 'user-alice', envelope: tampered, key }),
  { ok: false, error: 'MEMORY_DECRYPT_FAILED' }
);

for (const invalid of [
  { ownerId: '', snapshot, key },
  { ownerId: 'user-alice', snapshot: null, key },
  { ownerId: 'user-alice', snapshot: { entries: [] }, key },
  { ownerId: 'user-alice', snapshot, key: Buffer.alloc(31) },
  { ownerId: 'user-alice', snapshot, key: 'plaintext-secret' }
]) {
  assert.equal(encryptMemorySnapshot(invalid).ok, false);
}

for (const envelope of [
  null,
  { ...encrypted.envelope, version: 2 },
  { ...encrypted.envelope, algorithm: 'aes-128-gcm' },
  { ...encrypted.envelope, iv: Buffer.alloc(4).toString('base64') },
  { ...encrypted.envelope, tag: Buffer.alloc(4).toString('base64') },
  { ...encrypted.envelope, extra: true }
]) {
  assert.equal(decryptMemorySnapshot({ ownerId: 'user-alice', envelope, key }).ok, false);
}

const records = new Map();
const calls = [];
const persistence = createEncryptedMemoryPersistence({
  keyProvider: async (ownerId) => {
    calls.push(['key', ownerId]);
    return key;
  },
  readEnvelope: async (ownerId) => {
    calls.push(['read', ownerId]);
    return records.get(ownerId) ?? null;
  },
  writeEnvelope: async (ownerId, envelope) => {
    calls.push(['write', ownerId]);
    records.set(ownerId, envelope);
  },
  deleteEnvelope: async (ownerId) => {
    calls.push(['delete', ownerId]);
    records.delete(ownerId);
  }
});

assert.deepEqual(await persistence.load('user-alice'), { ok: true, snapshot: null });
assert.deepEqual(await persistence.save('user-alice', snapshot), { ok: true });
assert.equal(records.has('user-alice'), true);
assert.equal(JSON.stringify(records.get('user-alice')).includes('tenis'), false);
assert.deepEqual(await persistence.load('user-alice'), { ok: true, snapshot });
assert.deepEqual(await persistence.remove('user-alice'), { ok: true });
assert.equal(records.has('user-alice'), false);
assert.equal(calls.some(([kind]) => kind === 'write'), true);
assert.equal(calls.some(([kind]) => kind === 'delete'), true);

const failingPersistence = createEncryptedMemoryPersistence({
  keyProvider: async () => key,
  readEnvelope: async () => { throw new Error('READ_FAILED'); },
  writeEnvelope: async () => { throw new Error('WRITE_FAILED'); },
  deleteEnvelope: async () => { throw new Error('DELETE_FAILED'); }
});
assert.deepEqual(await failingPersistence.load('user-alice'), { ok: false, error: 'READ_FAILED' });
assert.deepEqual(await failingPersistence.save('user-alice', snapshot), { ok: false, error: 'WRITE_FAILED' });
assert.deepEqual(await failingPersistence.remove('user-alice'), { ok: false, error: 'DELETE_FAILED' });

for (const options of [
  {},
  { readEnvelope: async () => null },
  { readEnvelope: async () => null, writeEnvelope: async () => {} },
  {
    readEnvelope: async () => null,
    writeEnvelope: async () => {},
    deleteEnvelope: async () => {}
  }
]) {
  assert.throws(() => createEncryptedMemoryPersistence(options), /INVALID_MEMORY_PERSISTENCE/);
}

console.log('encrypted memory persistence tests passed');
