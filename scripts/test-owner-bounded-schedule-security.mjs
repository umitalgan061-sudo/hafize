import assert from 'node:assert/strict';
import {
  countOwnedActiveEntries,
  normalizeOwnerId,
  normalizeOwnerMaxEntries
} from '../lib/owner-bounded-schedule-store.mjs';

assert.equal(normalizeOwnerId(' alice '), 'alice');
assert.equal(normalizeOwnerId(null), null);
assert.throws(() => normalizeOwnerId(''), /INVALID_TASK_SCHEDULE:ownerId/);
assert.throws(() => normalizeOwnerId('x'.repeat(201)), /INVALID_TASK_SCHEDULE:ownerId/);
assert.equal(normalizeOwnerMaxEntries(), 100);
assert.equal(normalizeOwnerMaxEntries(1), 1);
assert.equal(normalizeOwnerMaxEntries(1000), 1000);
assert.throws(() => normalizeOwnerMaxEntries(0), /INVALID_OWNER_SCHEDULE_LIMIT/);
assert.throws(() => normalizeOwnerMaxEntries(1001), /INVALID_OWNER_SCHEDULE_LIMIT/);
assert.throws(() => normalizeOwnerMaxEntries(1.5), /INVALID_OWNER_SCHEDULE_LIMIT/);

const snapshot = { entries: [
  { ownerId: 'alice', status: 'scheduled' },
  { ownerId: 'alice', status: 'running' },
  { ownerId: 'alice', status: 'completed' },
  { ownerId: 'alice', status: 'cancelled' },
  { ownerId: 'bob', status: 'scheduled' },
  { ownerId: null, status: 'scheduled' }
] };
assert.equal(countOwnedActiveEntries(snapshot, 'alice'), 2);
assert.equal(countOwnedActiveEntries(snapshot, 'bob'), 1);
assert.equal(countOwnedActiveEntries(snapshot, 'nobody'), 0);
assert.throws(() => countOwnedActiveEntries({}, 'alice'), /INVALID_OWNER_SCHEDULE_SNAPSHOT/);

const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../lib/owner-bounded-schedule-store.mjs', import.meta.url), 'utf8'));
for (const forbidden of ['child_process', 'exec(', 'spawn(', 'shell: true', 'process.env', 'Authorization', 'cookie']) {
  assert.equal(source.includes(forbidden), false, `forbidden surface: ${forbidden}`);
}

console.log('owner schedule security boundary: ok');
