import assert from 'node:assert/strict';
import {
  createPersonalMemoryStore,
  PERSONAL_MEMORY_STORE_SCHEMA_VERSION
} from '../lib/personal-memory-store.mjs';

let clock = new Date('2026-08-13T13:30:00.000Z');
let idNo = 0;
const store = createPersonalMemoryStore({
  maxEntries: 8,
  now: () => new Date(clock),
  createId: () => `testid${String(++idNo).padStart(4, '0')}`
});

const missingIntent = store.write({
  ownerId: 'user-alice',
  kind: 'preference',
  content: 'Sessiz çalışma ortamını severim.',
  sourceType: 'user_statement',
  sensitivity: 'personal'
});
assert.deepEqual(missingIntent, { ok: false, error: 'MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT' });
assert.equal(store.snapshot().entries.length, 0);

const first = store.write({
  ownerId: 'user-alice',
  kind: 'identity',
  content: 'Ankara’da yaşıyorum.',
  sourceType: 'user_statement',
  sourceRef: 'conversation-1',
  sensitivity: 'personal',
  explicitUserIntent: true
});
assert.equal(first.ok, true);
assert.equal(first.record.memoryId, 'memory_testid0001');
assert.equal(first.record.ownerId, 'user-alice');
assert.equal(first.record.createdAt, '2026-08-13T13:30:00.000Z');
assert.equal(first.record.updatedAt, null);

clock = new Date('2026-08-13T13:31:00.000Z');
const second = store.write({
  ownerId: 'user-alice',
  kind: 'preference',
  content: 'Akşamları tenis oynamayı seviyorum.',
  sourceType: 'user_note',
  sourceRef: 'note-7',
  sensitivity: 'personal',
  explicitUserIntent: true
});
assert.equal(second.ok, true);

clock = new Date('2026-08-13T13:32:00.000Z');
const third = store.write({
  ownerId: 'user-bob',
  kind: 'note',
  content: 'Ankara toplantısı için tenis kortuna uğra.',
  sourceType: 'user_import',
  sourceRef: 'import-3',
  sensitivity: 'personal',
  explicitUserIntent: true
});
assert.equal(third.ok, true);

const aliceAnkara = store.read({ ownerId: 'user-alice', query: 'ANKARA', limit: 10 });
assert.equal(aliceAnkara.ok, true);
assert.deepEqual(aliceAnkara.records.map((record) => record.memoryId), [first.record.memoryId]);
assert.equal(aliceAnkara.records.some((record) => record.ownerId === 'user-bob'), false);

const aliceTennis = store.read({
  ownerId: 'user-alice',
  query: 'akşam tenis',
  kinds: ['preference'],
  limit: 5
});
assert.deepEqual(aliceTennis.records.map((record) => record.memoryId), [second.record.memoryId]);
assert.deepEqual(
  store.read({ ownerId: 'user-alice', query: 'tenis', kinds: ['project'] }).records,
  []
);

const context = store.readForContext({ ownerId: 'user-alice', query: 'tenis', limit: 20 });
assert.equal(context.ok, true);
assert.equal(context.records.length, 1);
assert.equal(context.records[0].memoryId, second.record.memoryId);
assert.equal(context.records[0].sourceType, 'user_note');
assert.equal(context.records[0].sourceRef, 'note-7');
assert.equal('ownerId' in context.records[0], false);
assert.equal('sensitivity' in context.records[0], false);
assert.equal('createdAt' in context.records[0], false);

const foreignDelete = store.remove({
  ownerId: 'user-bob',
  memoryId: first.record.memoryId,
  exactMatch: true
});
assert.deepEqual(foreignDelete, { ok: false, error: 'MEMORY_NOT_FOUND' });
assert.equal(store.read({ ownerId: 'user-alice', query: 'ankara' }).records.length, 1);

assert.deepEqual(
  store.remove({ ownerId: 'user-alice', memoryId: first.record.memoryId, exactMatch: false }),
  { ok: false, error: 'MEMORY_DELETE_REQUIRES_EXACT_MATCH' }
);
assert.deepEqual(
  store.remove({ ownerId: 'user-alice', memoryId: first.record.memoryId, exactMatch: true }),
  { ok: true, memoryId: first.record.memoryId }
);
assert.equal(store.read({ ownerId: 'user-alice', query: 'ankara' }).records.length, 0);

const snapshot = store.snapshot();
assert.equal(snapshot.schemaVersion, PERSONAL_MEMORY_STORE_SCHEMA_VERSION);
assert.equal(snapshot.entries.length, 2);
snapshot.entries[0].content = 'outside mutation';
assert.notEqual(store.snapshot().entries[0].content, 'outside mutation');

const restored = createPersonalMemoryStore({
  maxEntries: 8,
  initialSnapshot: store.snapshot(),
  now: () => new Date('2026-08-13T14:00:00.000Z'),
  createId: () => 'restored001'
});
assert.equal(restored.snapshot().entries.length, 2);
assert.deepEqual(
  restored.read({ ownerId: 'user-alice', query: 'tenis' }).records.map((record) => record.memoryId),
  [second.record.memoryId]
);
assert.equal(restored.read({ ownerId: 'user-bob', query: 'ankara' }).records[0].memoryId, third.record.memoryId);

for (const invalidSnapshot of [
  { schemaVersion: 2, entries: [] },
  { schemaVersion: 1, entries: [], extra: true },
  { schemaVersion: 1, entries: [{ memoryId: 'bad' }] },
  {
    schemaVersion: 1,
    entries: [
      store.snapshot().entries[0],
      { ...store.snapshot().entries[0] }
    ]
  }
]) {
  assert.throws(
    () => createPersonalMemoryStore({ initialSnapshot: invalidSnapshot }),
    /INVALID_MEMORY_STORE_SNAPSHOT/
  );
}

const tiny = createPersonalMemoryStore({
  maxEntries: 1,
  createId: (() => {
    let no = 0;
    return () => `tinytest${++no}`;
  })()
});
assert.equal(tiny.write({
  ownerId: 'u', kind: 'note', content: 'Bir', sourceType: 'user_note',
  sensitivity: 'personal', explicitUserIntent: true
}).ok, true);
assert.deepEqual(tiny.write({
  ownerId: 'u', kind: 'note', content: 'İki', sourceType: 'user_note',
  sensitivity: 'personal', explicitUserIntent: true
}), { ok: false, error: 'MEMORY_STORE_FULL' });

const collision = createPersonalMemoryStore({ createId: () => 'sameid000' });
assert.equal(collision.write({
  ownerId: 'u', kind: 'note', content: 'Bir', sourceType: 'user_note',
  sensitivity: 'personal', explicitUserIntent: true
}).ok, true);
assert.deepEqual(collision.write({
  ownerId: 'u', kind: 'note', content: 'İki', sourceType: 'user_note',
  sensitivity: 'personal', explicitUserIntent: true
}), { ok: false, error: 'MEMORY_ID_COLLISION' });

const invalidId = createPersonalMemoryStore({ createId: () => 'x' });
assert.deepEqual(invalidId.write({
  ownerId: 'u', kind: 'note', content: 'Bir', sourceType: 'user_note',
  sensitivity: 'personal', explicitUserIntent: true
}), { ok: false, error: 'MEMORY_ID_GENERATION_FAILED' });

const badClock = createPersonalMemoryStore({ now: () => new Date('invalid'), createId: () => 'clockid000' });
assert.deepEqual(badClock.write({
  ownerId: 'u', kind: 'note', content: 'Bir', sourceType: 'user_note',
  sensitivity: 'personal', explicitUserIntent: true
}), { ok: false, error: 'INVALID_MEMORY_STORE:now' });

await import('./test-personal-memory-server-runtime.mjs');
await import('./test-personal-memory-production-runtime.mjs');
await import('./test-personal-memory-server-wiring.mjs');
await import('./test-personal-memory-server-http.mjs');

console.log('personal memory store tests passed');