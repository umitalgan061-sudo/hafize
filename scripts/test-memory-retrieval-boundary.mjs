import assert from 'node:assert/strict';
import {
  MEMORY_RETRIEVAL_LIMIT,
  normalizeMemoryRetrieval
} from '../lib/memory-retrieval-boundary.mjs';

assert.equal(MEMORY_RETRIEVAL_LIMIT, 5);

const record = {
  memoryId: 'memory_abcdefgh1234',
  ownerId: 'user-1',
  kind: 'project',
  content: 'Hafize projesi üzerinde çalışıyor.',
  sourceType: 'user_statement',
  sourceRef: 'conversation-1:message-2'
};
const normalized = normalizeMemoryRetrieval({ ownerId: ' user-1 ', records: [record] });
assert.deepEqual(normalized, {
  ok: true,
  records: [{
    memoryId: 'memory_abcdefgh1234',
    kind: 'project',
    content: 'Hafize projesi üzerinde çalışıyor.',
    sourceType: 'user_statement',
    sourceRef: 'conversation-1:message-2'
  }]
});
assert.equal('ownerId' in normalized.records[0], false);

assert.deepEqual(
  normalizeMemoryRetrieval({ ownerId: 'user-2', records: [record] }),
  { ok: false, error: 'MEMORY_RETRIEVAL_SCOPE_MISMATCH' }
);
assert.deepEqual(
  normalizeMemoryRetrieval({ ownerId: 'user-1', records: [{ ...record, memoryId: 'all' }] }),
  { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:memoryId' }
);
assert.deepEqual(
  normalizeMemoryRetrieval({ ownerId: 'user-1', records: [{ ...record, kind: 'other' }] }),
  { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:kind' }
);
assert.deepEqual(
  normalizeMemoryRetrieval({ ownerId: 'user-1', records: [{ ...record, sourceType: 'assistant_guess' }] }),
  { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:sourceType' }
);
assert.deepEqual(
  normalizeMemoryRetrieval({ ownerId: 'user-1', records: Array.from({ length: 6 }, () => record) }),
  { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:records' }
);
assert.deepEqual(
  normalizeMemoryRetrieval({ ownerId: 'user-1', records: [] }),
  { ok: true, records: [] }
);
assert.deepEqual(
  normalizeMemoryRetrieval({ ownerId: '', records: [] }),
  { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:ownerId' }
);

// Sınır hiçbir girdide fırlatmaz; nesne olmayan girdide de { ok: false } döner.
for (const input of [null, [], 'user-1', 42]) {
  assert.deepEqual(
    normalizeMemoryRetrieval(input),
    { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:input' },
    `nesne olmayan girdi kodsuz hata üretmemeli: ${JSON.stringify(input)}`
  );
}
assert.deepEqual(normalizeMemoryRetrieval(), { ok: false, error: 'INVALID_MEMORY_RETRIEVAL:ownerId' });

console.log('memory retrieval boundary tests passed');
