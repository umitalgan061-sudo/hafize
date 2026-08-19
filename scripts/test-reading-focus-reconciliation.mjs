import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const focus = require('../public/reading-focus.js');

function state(focusMode, bookmarkIds) {
  return { focusMode, bookmarkIds, legacyBookmarkIds: [] };
}

function createStorage(initialState = state(false, [])) {
  let raw = focus.serializeState(initialState);
  const writes = [];
  return {
    writes,
    get raw() { return raw; },
    getItem(key) {
      assert.equal(key, focus.STORAGE_KEY);
      return raw;
    },
    setItem(key, value) {
      assert.equal(key, focus.STORAGE_KEY);
      raw = String(value);
      writes.push(raw);
    }
  };
}

assert.equal(focus.MAX_SESSION_MUTATIONS, 200);
assert.equal(focus.MAX_RECONCILIATION_REPLAYS, 2);

const bookmarkMutation = focus.normalizeStateMutation({
  kind: 'bookmark', key: 'c1|m1', before: false, after: true
});
assert.deepEqual(bookmarkMutation, {
  kind: 'bookmark', key: 'c1|m1', before: false, after: true, replays: 0
});
assert.equal(focus.mutationId(bookmarkMutation), 'bookmark:c1|m1');
assert.equal(focus.mutationValue(state(false, []), bookmarkMutation), false);
assert.equal(focus.mutationValue(state(false, ['c1|m1']), bookmarkMutation), true);
assert.equal(focus.normalizeStateMutation({ kind: 'bookmark', key: 'bad key', before: false, after: true }), null);
assert.equal(focus.normalizeStateMutation({ kind: 'focus', before: true, after: true }), null);

const focusMutation = focus.normalizeStateMutation({ kind: 'focus', before: false, after: true });
assert.equal(focus.mutationId(focusMutation), 'focus');
assert.equal(focus.mutationValue(state(false, []), focusMutation), false);
assert.equal(focus.mutationValue(state(true, []), focusMutation), true);

assert.equal(
  focus.stateDiffCount(state(false, ['c1|m1']), state(false, ['c2|m2'])),
  2,
  'replacing one bookmark with another changes two independent bookmark dimensions'
);
assert.equal(
  focus.stateDiffCount(state(true, ['c1|m1']), state(false, ['c1|m1', 'c2|m2'])),
  2,
  'focus plus bookmark transition changes two independent dimensions'
);

{
  const merged = focus.applyStateMutation(state(false, ['c2|m2']), bookmarkMutation);
  assert.deepEqual(merged, state(false, ['c2|m2', 'c1|m1']));
}

{
  const before = state(false, ['c1|m1']);
  const remote = state(false, ['c2|m2']);
  const result = focus.reconcileStateMutation(before, remote, bookmarkMutation, {
    validKeys: new Set(['c1|m1', 'c2|m2'])
  });
  assert.equal(result.action, 'replay');
  assert.deepEqual(result.state, state(false, ['c2|m2', 'c1|m1']));
  assert.equal(result.mutation.replays, 1);
}

{
  const before = state(false, ['c1|m1']);
  const remote = state(false, []);
  const result = focus.reconcileStateMutation(before, remote, bookmarkMutation, {
    validKeys: new Set(['c1|m1'])
  });
  assert.equal(result.action, 'conflict', 'single-key remote reversal is a real same-bookmark conflict');
  assert.deepEqual(result.state, remote);
}

{
  const before = state(false, ['c1|m1']);
  const remote = state(false, ['c2|m2']);
  const result = focus.reconcileStateMutation(before, remote, bookmarkMutation, {
    validKeys: new Set(['c2|m2'])
  });
  assert.equal(result.action, 'drop', 'deleted/retention-evicted message bookmarks must never be resurrected');
  assert.deepEqual(result.state, remote);
}

{
  const alreadyAcknowledged = focus.reconcileStateMutation(
    state(false, []),
    state(false, ['c1|m1', 'c2|m2']),
    bookmarkMutation,
    { validKeys: new Set(['c1|m1', 'c2|m2']) }
  );
  assert.equal(alreadyAcknowledged.action, 'acknowledge');
}

{
  const before = state(true, []);
  const remote = state(false, ['c2|m2']);
  const result = focus.reconcileStateMutation(before, remote, focusMutation, {
    validKeys: new Set(['c2|m2'])
  });
  assert.equal(result.action, 'replay', 'bookmark write must not collaterally erase a local focus-mode intent');
  assert.deepEqual(result.state, state(true, ['c2|m2']));
}

{
  const before = state(true, []);
  const remote = state(false, []);
  const result = focus.reconcileStateMutation(before, remote, focusMutation);
  assert.equal(result.action, 'conflict', 'direct remote focus reversal wins as a real same-field conflict');
}

{
  const exhausted = focus.normalizeStateMutation({
    kind: 'bookmark', key: 'c1|m1', before: false, after: true,
    replays: focus.MAX_RECONCILIATION_REPLAYS
  });
  const result = focus.reconcileStateMutation(
    state(false, ['c1|m1']),
    state(false, ['c2|m2']),
    exhausted,
    { validKeys: new Set(['c1|m1', 'c2|m2']) }
  );
  assert.equal(result.action, 'conflict', 'bounded replay budget prevents permanent write ping-pong');
}

{
  const storage = createStorage(state(true, ['c2|m2']));
  const result = focus.writeBookmarkPreference(storage, 'c1|m1', true);
  assert.equal(result.persisted, true);
  assert.deepEqual(result.state, state(true, ['c2|m2', 'c1|m1']));
  assert.deepEqual(result.mutation, {
    kind: 'bookmark', key: 'c1|m1', before: false, after: true, replays: 0
  });
  assert.equal(storage.writes.length, 1);
  assert.deepEqual(focus.parseState(storage.raw), state(true, ['c2|m2', 'c1|m1']));
}

{
  const storage = createStorage(state(false, ['c1|m1', 'c2|m2']));
  const result = focus.writeFocusPreference(storage, true);
  assert.equal(result.persisted, true);
  assert.deepEqual(result.state, state(true, ['c1|m1', 'c2|m2']));
  assert.deepEqual(result.mutation, { kind: 'focus', before: false, after: true, replays: 0 });
  assert.equal(storage.writes.length, 1);
}

{
  const storage = createStorage(state(true, ['c1|m1']));
  const bookmarkNoop = focus.writeBookmarkPreference(storage, 'c1|m1', true);
  const focusNoop = focus.writeFocusPreference(storage, true);
  assert.equal(bookmarkNoop.changed, false);
  assert.equal(focusNoop.changed, false);
  assert.equal(storage.writes.length, 0, 'canonical no-op writes must not create storage-event ping-pong');
}

{
  const storage = createStorage(state(false, ['c1|m1']));
  storage.setItem = () => { throw new Error('quota'); };
  const result = focus.writeBookmarkPreference(storage, 'c2|m2', true);
  assert.equal(result.changed, true);
  assert.equal(result.persisted, false);
  assert.equal(result.mutation, null, 'failed writes must never create a replayable session intent');
  assert.deepEqual(result.state, state(false, ['c1|m1']));
}

console.log('reading focus cross-tab reconciliation tests passed');
