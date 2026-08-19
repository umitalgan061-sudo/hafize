import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modelState = require('../public/conversation-model-state.js');

const MODEL_A = 'nvidia/meta/llama-3.1-70b-instruct';
const MODEL_B = 'local:qwen2.5:7b';

function storage(seed = {}) {
  const map = new Map(Object.entries(seed));
  let writes = 0;
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { writes += 1; map.set(String(key), String(value)); },
    raw(key) { return map.get(key); },
    writes() { return writes; }
  };
}

function documentWithRows(rows = []) {
  const select = {
    value: MODEL_A,
    disabled: false,
    options: [{ value: MODEL_A }, { value: MODEL_B }],
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {}
  };
  const list = { querySelectorAll() { return rows; } };
  const send = { classList: { contains() { return false; } } };
  return {
    querySelector(selector) {
      if (selector === '#modelSelect') return select;
      if (selector === '#conversationList') return list;
      if (selector === '#sendBtn') return send;
      return null;
    }
  };
}

const conversations = [
  { id: 'conversation-one', messages: [] },
  { id: 'conversation-two', messages: [] }
];

assert.equal(modelState.MAX_STORAGE_CHARS, 32 * 1024);

{
  const state = storage({
    [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
      { conversationId: 'conversation-one', modelId: MODEL_A, token: 'drop-me' },
      { conversationId: 'deleted', modelId: MODEL_B },
      { conversationId: 'conversation-one', modelId: MODEL_B }
    ])
  });
  assert.equal(modelState.compactModelEntries(state, conversations), true);
  assert.deepEqual(JSON.parse(state.raw(modelState.MODEL_STORAGE_KEY)), [
    { conversationId: 'conversation-one', modelId: MODEL_A }
  ]);
  assert.equal(state.raw(modelState.MODEL_STORAGE_KEY).includes('token'), false);
}

{
  const canonical = JSON.stringify([
    { conversationId: 'conversation-one', modelId: MODEL_A },
    { conversationId: 'conversation-two', modelId: MODEL_B }
  ]);
  const state = storage({ [modelState.MODEL_STORAGE_KEY]: canonical });
  assert.equal(modelState.compactModelEntries(state, conversations), false);
  assert.equal(state.writes(), 0, 'canonical state must not cause storage-event ping-pong');
}

{
  const state = storage({
    [modelState.MODEL_STORAGE_KEY]: 'x'.repeat(modelState.MAX_STORAGE_CHARS + 1)
  });
  assert.equal(modelState.readModelRaw(state), null);
  assert.deepEqual(modelState.readModelEntries(state, conversations), []);
  assert.equal(modelState.compactModelEntries(state, conversations), true);
  assert.equal(state.raw(modelState.MODEL_STORAGE_KEY), '[]');
}

{
  // Same-tab clear renders an empty conversation list. Sync must compact stale model state
  // even though there is no active row from which to restore a selection.
  const state = storage({
    [modelState.CONVERSATION_STORAGE_KEY]: '[]',
    [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
      { conversationId: 'deleted', modelId: MODEL_B }
    ])
  });
  const controller = modelState.createController({
    documentRef: documentWithRows([]),
    storage: state,
    rootRef: { addEventListener() {}, removeEventListener() {} },
    MutationObserverImpl: null,
    EventImpl: class FakeEvent {},
    queueMicrotaskImpl: (fn) => fn()
  });
  assert.equal(controller.restoreSelection(), false);
  assert.equal(state.raw(modelState.MODEL_STORAGE_KEY), '[]');
}

{
  // An inactive deleted conversation must be removed even when the active conversation's
  // saved model is already correct and would otherwise return early without writing.
  const rows = [
    {
      dataset: { conversationOrganizeId: 'conversation-one' },
      classList: { contains(name) { return name === 'active'; } }
    },
    {
      dataset: { conversationOrganizeId: 'conversation-two' },
      classList: { contains() { return false; } }
    }
  ];
  const documentRef = documentWithRows(rows);
  const state = storage({
    [modelState.CONVERSATION_STORAGE_KEY]: JSON.stringify(conversations),
    [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
      { conversationId: 'conversation-one', modelId: MODEL_A },
      { conversationId: 'deleted', modelId: MODEL_B }
    ])
  });
  const controller = modelState.createController({
    documentRef,
    storage: state,
    rootRef: { addEventListener() {}, removeEventListener() {} },
    MutationObserverImpl: null,
    EventImpl: class FakeEvent {},
    queueMicrotaskImpl: (fn) => fn()
  });
  assert.equal(controller.restoreSelection(), true);
  assert.deepEqual(JSON.parse(state.raw(modelState.MODEL_STORAGE_KEY)), [
    { conversationId: 'conversation-one', modelId: MODEL_A }
  ]);
}

console.log('conversation model state compaction tests passed');
