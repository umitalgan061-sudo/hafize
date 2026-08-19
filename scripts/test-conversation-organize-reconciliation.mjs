import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const organize = require('../public/conversation-organize.js');

const pinnedA = { id: 'a', title: null, pinned: true };
const titledA = { id: 'a', title: 'A yeni', pinned: false };
const oldA = { id: 'a', title: 'A eski', pinned: false };
const pinnedB = { id: 'b', title: null, pinned: true };

assert.equal(organize.MAX_SESSION_MUTATIONS, 30);
assert.equal(organize.sameEntry(null, null), true);
assert.equal(organize.sameEntry(pinnedA, { ...pinnedA, token: 'ignored' }), true);
assert.equal(organize.sameEntry(pinnedA, titledA), false);
assert.deepEqual(organize.entryFor([pinnedA, pinnedB], 'b'), pinnedB);
assert.equal(organize.entryFor([pinnedA], 'missing'), null);

{
  const mutation = organize.normalizeMutation({
    id: 'a',
    before: null,
    after: { ...pinnedA, credential: 'must-not-survive' },
    traceId: 'must-not-survive'
  });
  assert.deepEqual(mutation, { id: 'a', before: null, after: pinnedA });
  assert.equal(JSON.stringify(mutation).includes('credential'), false);
  assert.equal(JSON.stringify(mutation).includes('traceId'), false);
}

{
  const result = organize.reconcileMutation([pinnedB], {
    id: 'a', before: null, after: pinnedA
  });
  assert.equal(result.status, 'replay', 'remote disjoint write carried stale absence for local a');
  assert.deepEqual(result.entries, [pinnedA, pinnedB]);

  const acknowledged = organize.reconcileMutation(result.entries, {
    id: 'a', before: null, after: pinnedA
  });
  assert.equal(acknowledged.status, 'settled');
  assert.deepEqual(acknowledged.entries, result.entries);
}

{
  const remote = [
    { id: 'a', title: 'Uzak başlık', pinned: true },
    pinnedB
  ];
  const result = organize.reconcileMutation(remote, {
    id: 'a', before: oldA, after: titledA
  });
  assert.equal(result.status, 'conflict', 'real same-conversation remote change must win');
  assert.deepEqual(result.entries, remote);
}

{
  const result = organize.reconcileMutation([oldA, pinnedB], {
    id: 'a', before: oldA, after: titledA
  });
  assert.equal(result.status, 'replay', 'stale old title carried by remote disjoint write must be replaced');
  assert.deepEqual(result.entries, [titledA, pinnedB]);
}

{
  const result = organize.reconcileMutation([oldA, pinnedB], {
    id: 'a', before: oldA, after: null
  });
  assert.equal(result.status, 'replay', 'local metadata removal must survive stale remote carry-forward');
  assert.deepEqual(result.entries, [pinnedB]);

  const settled = organize.reconcileMutation([pinnedB], {
    id: 'a', before: oldA, after: null
  });
  assert.equal(settled.status, 'settled');
}

{
  const replaced = organize.replaceEntry([oldA, pinnedB], 'a', titledA);
  assert.deepEqual(replaced, [titledA, pinnedB]);
  assert.deepEqual(organize.replaceEntry(replaced, 'a', null), [pinnedB]);
  assert.deepEqual(organize.replaceEntry(replaced, 'bad id', null), replaced);
}

{
  assert.equal(organize.normalizeMutation({ id: 'a', before: pinnedA, after: pinnedA }), null);
  assert.equal(organize.normalizeMutation({ id: 'bad id', before: null, after: pinnedA }), null);
  assert.equal(organize.normalizeMutation({ id: 'a', before: null, after: { id: 'b', pinned: true } }), null);
  assert.equal(organize.reconcileMutation([pinnedB], null).status, 'invalid');
}

{
  // Two tabs changed different conversations from the same empty baseline.
  const aMutation = { id: 'a', before: null, after: pinnedA };
  const bMutation = { id: 'b', before: null, after: pinnedB };
  const afterBOverwrite = organize.reconcileMutation([pinnedB], aMutation);
  assert.equal(afterBOverwrite.status, 'replay');
  const converged = afterBOverwrite.entries;
  assert.equal(organize.reconcileMutation(converged, aMutation).status, 'settled');
  assert.equal(organize.reconcileMutation(converged, bMutation).status, 'settled');
  assert.deepEqual(new Set(converged.map((entry) => entry.id)), new Set(['a', 'b']));
}

console.log('conversation organize reconciliation tests passed');
