import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-organize.js');

const before = Object.freeze({ id: 'a', title: null, pinned: false });
const after = Object.freeze({ id: 'a', title: 'Özel başlık', pinned: true });
const mutation = api.normalizeMutation({ id: 'a', before, after });

assert.ok(mutation);
assert.equal(Object.isFrozen(mutation), true);
assert.deepEqual(mutation.before, before);
assert.deepEqual(mutation.after, after);

assert.equal(api.normalizeMutation(null), null);
assert.equal(api.normalizeMutation([]), null);
assert.equal(api.normalizeMutation({ id: 'bad id', before, after }), null);
assert.equal(api.normalizeMutation({ id: 'a', before, after: before }), null, 'no-op mutation is rejected');
assert.equal(api.normalizeMutation({ id: 'a', before: { ...before, id: 'b' }, after }), null);
assert.equal(api.normalizeMutation({ id: 'a', before, after: { ...after, id: 'b' } }), null);

{
  const result = api.reconcileMutation([before], mutation);
  assert.equal(result.status, 'replay');
  assert.deepEqual(result.entries, [after], 'exact before state replays local mutation');
}

{
  const result = api.reconcileMutation([after], mutation);
  assert.equal(result.status, 'settled');
  assert.deepEqual(result.entries, [after], 'exact after state is already settled');
}

{
  const remote = [{ id: 'a', title: 'Başka sekme', pinned: false }];
  const result = api.reconcileMutation(remote, mutation);
  assert.equal(result.status, 'conflict');
  assert.deepEqual(result.entries, remote, 'remote divergence wins instead of blind overwrite');
}

{
  const result = api.reconcileMutation([], mutation);
  assert.equal(result.status, 'conflict', 'missing remote entry does not recreate deleted metadata');
  assert.deepEqual(result.entries, []);
}

{
  const invalid = api.reconcileMutation([before], { id: 'a', before, after: before });
  assert.equal(invalid.status, 'invalid');
  assert.deepEqual(invalid.entries, [before]);
}

{
  const entries = Array.from({ length: 35 }, (_, index) => ({
    id: `id-${index}`,
    title: `Başlık ${index}`,
    pinned: index % 2 === 0
  }));
  assert.equal(api.normalizeEntries(entries).length, api.MAX_ENTRIES, 'metadata remains bounded');
}

console.log('conversation organize mutation reconcile tests passed');