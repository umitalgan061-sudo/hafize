import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-model-state.js');

const entry = (conversationId, modelId) => ({ conversationId, modelId });
const mutation = (conversationId, before, after) => ({ conversationId, before, after });

assert.equal(api.MAX_SESSION_MUTATIONS, 30);
assert.deepEqual(api.parseModelEntries('', []), []);
assert.deepEqual(api.parseModelEntries('{broken', []), []);
assert.deepEqual(
  api.parseModelEntries(JSON.stringify([
    entry('a', 'model/a'),
    { conversationId: 'a', modelId: 'duplicate' },
    { conversationId: 'missing', modelId: 'model/missing' },
    { conversationId: 'b', modelId: 'model/b', token: 'must-not-survive' }
  ]), [{ id: 'a' }, { id: 'b' }]),
  [entry('a', 'model/a'), entry('b', 'model/b')]
);

{
  const before = [entry('a', 'model/old'), entry('b', 'model/old')];
  const afterLocal = [entry('a', 'model/new'), entry('b', 'model/old')];
  const staleRemote = [entry('b', 'model/new'), entry('a', 'model/old')];
  const result = api.reconcileModelMutation(
    staleRemote,
    mutation('a', entry('a', 'model/old'), entry('a', 'model/new')),
    afterLocal
  );
  assert.equal(result.status, 'replay');
  assert.deepEqual(result.entries, [entry('a', 'model/new'), entry('b', 'model/new')]);
  assert.deepEqual(api.changedModelEntryIds(afterLocal, staleRemote).sort(), ['a', 'b']);
  assert.notDeepEqual(before, afterLocal);
}

{
  const localAfter = [entry('a', 'model/new')];
  const deliberateRemote = [entry('a', 'model/old')];
  const result = api.reconcileModelMutation(
    deliberateRemote,
    mutation('a', entry('a', 'model/old'), entry('a', 'model/new')),
    localAfter
  );
  assert.equal(result.status, 'conflict', 'single-entry remote reversal must win as a real conflict');
  assert.deepEqual(result.entries, deliberateRemote);
}

{
  const localAfter = [entry('a', 'model/new'), entry('b', 'model/old')];
  const remoteThirdValue = [entry('a', 'model/other'), entry('b', 'model/new')];
  const result = api.reconcileModelMutation(
    remoteThirdValue,
    mutation('a', entry('a', 'model/old'), entry('a', 'model/new')),
    localAfter
  );
  assert.equal(result.status, 'conflict');
  assert.deepEqual(result.entries, remoteThirdValue);
}

{
  const settled = [entry('a', 'model/new'), entry('b', 'model/new')];
  const result = api.reconcileModelMutation(
    settled,
    mutation('a', entry('a', 'model/old'), entry('a', 'model/new')),
    [entry('a', 'model/new'), entry('b', 'model/old')]
  );
  assert.equal(result.status, 'settled');
  assert.deepEqual(result.entries, settled);
}

{
  const localAfter = [entry('a', 'model/new'), entry('b', 'model/old')];
  const staleRemote = [entry('b', 'model/new')];
  const result = api.reconcileModelMutation(
    staleRemote,
    mutation('a', null, entry('a', 'model/new')),
    localAfter
  );
  assert.equal(result.status, 'replay', 'a stale remote snapshot may not erase a newly-created preference');
  assert.deepEqual(result.entries, [entry('a', 'model/new'), entry('b', 'model/new')]);
}

assert.equal(api.normalizeModelMutation(null), null);
assert.equal(api.normalizeModelMutation({
  conversationId: 'a',
  before: entry('a', 'same'),
  after: entry('a', 'same')
}), null);
assert.equal(api.normalizeModelMutation({
  conversationId: 'a',
  before: entry('b', 'old'),
  after: entry('a', 'new')
}), null);
assert.deepEqual(
  api.replaceModelEntry([entry('a', 'old'), entry('b', 'keep')], 'a', entry('a', 'new')),
  [entry('a', 'new'), entry('b', 'keep')]
);

function memoryStorage(seed) {
  const values = new Map(Object.entries(seed));
  let writes = 0;
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes += 1; values.set(String(key), String(value)); },
    raw(key) { return values.get(key); },
    writes() { return writes; }
  };
}

function row(id, active = false) {
  return {
    dataset: { conversationOrganizeId: id },
    classList: { contains(name) { return name === 'active' && active; } }
  };
}

function documentHarness(rows, selected = 'model/new') {
  const select = {
    value: selected,
    disabled: false,
    options: [{ value: 'model/old' }, { value: 'model/new' }, { value: 'model/other' }],
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}
  };
  const list = { querySelectorAll(selector) { return selector === '.conversation-row' ? rows : []; } };
  const send = { classList: { contains() { return false; } } };
  return {
    select,
    querySelector(selector) {
      if (selector === '#modelSelect') return select;
      if (selector === '#conversationList') return list;
      if (selector === '#sendBtn') return send;
      return null;
    }
  };
}

{
  const conversations = [{ id: 'a' }, { id: 'b' }];
  const initial = [entry('a', 'model/old'), entry('b', 'model/old')];
  const storage = memoryStorage({
    [api.CONVERSATION_STORAGE_KEY]: JSON.stringify(conversations),
    [api.MODEL_STORAGE_KEY]: JSON.stringify(initial)
  });
  const documentRef = documentHarness([row('a', true), row('b')]);
  const controller = api.createController({
    documentRef,
    storage,
    rootRef: { addEventListener() {}, removeEventListener() {} },
    MutationObserverImpl: null,
    EventImpl: class Event { constructor(type) { this.type = type; } },
    queueMicrotaskImpl() {}
  });

  assert.equal(controller.persistSelection(), true);
  assert.equal(controller.mutationSnapshot().length, 1);
  const localAfterRaw = storage.raw(api.MODEL_STORAGE_KEY);
  assert.deepEqual(JSON.parse(localAfterRaw), [entry('a', 'model/new'), entry('b', 'model/old')]);

  const staleRemoteRaw = JSON.stringify([entry('b', 'model/new'), entry('a', 'model/old')]);
  storage.setItem(api.MODEL_STORAGE_KEY, staleRemoteRaw);
  assert.equal(controller.reconcileStorageEvent({
    key: api.MODEL_STORAGE_KEY,
    oldValue: localAfterRaw,
    newValue: staleRemoteRaw
  }, conversations), true);
  assert.deepEqual(JSON.parse(storage.raw(api.MODEL_STORAGE_KEY)), [
    entry('a', 'model/new'),
    entry('b', 'model/new')
  ]);

  const writesAfterReplay = storage.writes();
  assert.equal(controller.reconcileStorageEvent({
    key: api.MODEL_STORAGE_KEY,
    oldValue: staleRemoteRaw,
    newValue: storage.raw(api.MODEL_STORAGE_KEY)
  }, conversations), false);
  assert.equal(controller.mutationSnapshot().length, 0, 'acknowledged local intent must leave session memory');
  assert.equal(storage.writes(), writesAfterReplay, 'settled state must not create storage-event ping-pong');
}

console.log('conversation model state reconciliation tests passed');