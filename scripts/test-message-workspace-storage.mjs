import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const policy = require(path.join(root, 'public/message-workspace-policy.js'));

class MemoryStorage {
  constructor(seed = {}) { this.map = new Map(Object.entries(seed)); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

class ThrowingStorage {
  getItem() { throw new Error('storage read denied'); }
  setItem() { throw new Error('storage write denied'); }
}

function record(index, overrides = {}) {
  return {
    id: `r-${index}`,
    conversationId: `c-${index % 2}`,
    messageId: `m-${index}`,
    saved: true,
    feedback: index % 2 ? 'down' : 'up',
    note: index % 3 ? '' : `not-${index}`,
    tags: [`tag-${index % 3}`],
    createdAt: '2026-09-10T10:00:00Z',
    updatedAt: '2026-09-10T10:00:00Z',
    ...overrides
  };
}

const good = new MemoryStorage({
  'hafize.message-workspace.v1': JSON.stringify([
    record(1),
    null,
    record(2, { id: 'duplicate' }),
    record(3, { id: 'duplicate', note: 'later' }),
    { conversationId: 'broken' }
  ]),
  'hafize.message-workspace.v1.state': JSON.stringify({
    query: '  HAFİZE  ',
    filter: 'assistant',
    sort: 'feedback',
    selected: ['r-1', 'r-1', 'r-2']
  })
});

const records = JSON.parse(good.getItem('hafize.message-workspace.v1'));
assert.equal(Array.isArray(records), true);
const normalized = policy.normalizeRecords(records);
assert.equal(normalized.length, 3);
assert.equal(new Set(normalized.map(item => item.id)).size, normalized.length);

const state = policy.normalizeState(JSON.parse(good.getItem('hafize.message-workspace.v1.state')));
assert.deepEqual(state, {
  query: 'hafi̇ze',
  filter: 'assistant',
  sort: 'feedback',
  selected: ['r-1', 'r-2']
});

good.setItem('hafize.message-workspace.v1', JSON.stringify(normalized));
const roundTrip = policy.normalizeRecords(JSON.parse(good.getItem('hafize.message-workspace.v1')));
assert.deepEqual(roundTrip.map(item => item.id), normalized.map(item => item.id));

const throwing = new ThrowingStorage();
assert.throws(() => JSON.parse(throwing.getItem('hafize.message-workspace.v1')), /storage read denied/);
assert.throws(() => throwing.setItem('hafize.message-workspace.v1', '[]'), /storage write denied/);

const corruptValues = [
  '',
  'null',
  '{}',
  '"array"',
  '{"broken":true}',
  '[{"conversationId":null,"messageId":null}]'
];
for (const raw of corruptValues) {
  let value;
  try { value = JSON.parse(raw); } catch { value = undefined; }
  assert.deepEqual(policy.normalizeRecords(value), []);
}

const stateCorruption = [null, [], 'x', { filter: 'bad' }, { selected: 'bad' }];
for (const value of stateCorruption) {
  const safe = policy.normalizeState(value);
  assert.equal(safe.filter, 'all');
  assert.equal(safe.sort, 'newest');
  assert.deepEqual(safe.selected, []);
}

const selection = policy.normalizeState({ selected: Array.from({ length: 150 }, (_, i) => `id-${i}`) });
assert.equal(selection.selected.length, 100);
assert.equal(new Set(selection.selected).size, 100);

const malformed = policy.normalizeRecords([
  record(10, { saved: 'true', feedback: 'yes', note: false, tags: [null, {}, 'ok'] }),
  record(11, { saved: false, feedback: '', note: '', tags: [] })
]);
assert.equal(malformed.length, 1);
assert.equal(malformed[0].id, 'r-10');
assert.equal(malformed[0].saved, false);
assert.equal(malformed[0].feedback, '');
assert.equal(malformed[0].note, 'false');
assert.deepEqual(malformed[0].tags, ['ok']);

for (let cycle = 0; cycle < 25; cycle += 1) {
  const batch = Array.from({ length: 12 }, (_, index) => record(cycle * 12 + index));
  const safe = policy.normalizeRecords(batch);
  const copy = JSON.parse(JSON.stringify(safe));
  assert.equal(policy.normalizeRecords(copy).length, safe.length);
}

console.log('message workspace storage resilience tests passed');
