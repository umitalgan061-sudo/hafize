import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modelState = require('../public/conversation-model-state.js');

const MODEL_A = 'nvidia/meta/llama-3.1-70b-instruct';
const MODEL_B = 'local:qwen2.5:7b';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  let writes = 0;
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes += 1; values.set(String(key), String(value)); },
    dump(key) { return values.get(key); },
    writes() { return writes; }
  };
}

function row({ id, active = false, marker = 'present' } = {}) {
  const dataset = {};
  if (marker === 'present') dataset.conversationOrganizeId = id;
  else if (marker === 'invalid') dataset.conversationOrganizeId = '../invalid';
  else if (marker === 'empty') dataset.conversationOrganizeId = '';
  return {
    dataset,
    classList: { contains(name) { return name === 'active' && active; } }
  };
}

function documentForRows(rows, selectedModel = MODEL_A) {
  const listeners = new Map();
  const select = {
    value: selectedModel,
    disabled: false,
    options: [{ value: MODEL_A }, { value: MODEL_B }],
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent() {}
  };
  const send = { classList: { contains() { return false; } } };
  const list = {
    querySelectorAll(selector) { return selector === '.conversation-row' ? rows : []; }
  };
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

function controllerFor(documentRef, storage) {
  return modelState.createController({
    documentRef,
    storage,
    rootRef: { addEventListener() {}, removeEventListener() {} },
    MutationObserverImpl: null,
    EventImpl: class FakeEvent { constructor(type) { this.type = type; } },
    queueMicrotaskImpl: (fn) => fn()
  });
}

const conversations = [
  { id: 'conversation-one', messages: [] },
  { id: 'conversation-two', messages: [] }
];

assert.equal(modelState.ORGANIZE_ID_DATASET_KEY, 'conversationOrganizeId');

// Organizer reorders conversation-two ahead of conversation-one. DOM index 0 must not
// be interpreted as canonical storage index 0.
const reorderedRows = [
  row({ id: 'conversation-two', active: true }),
  row({ id: 'conversation-one' })
];
const reorderedDocument = documentForRows(reorderedRows, MODEL_A);
assert.equal(
  modelState.activeConversationId(reorderedDocument, conversations),
  'conversation-two'
);

const restoreStorage = memoryStorage({
  [modelState.CONVERSATION_STORAGE_KEY]: JSON.stringify(conversations),
  [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
    { conversationId: 'conversation-one', modelId: MODEL_A },
    { conversationId: 'conversation-two', modelId: MODEL_B }
  ])
});
const restoreController = controllerFor(reorderedDocument, restoreStorage);
assert.equal(restoreController.restoreSelection(), true);
assert.equal(reorderedDocument.select.value, MODEL_B);

// Persist must also target the organizer identity rather than the reordered DOM index.
reorderedDocument.select.value = MODEL_A;
assert.equal(restoreController.persistSelection(), true);
const persisted = JSON.parse(restoreStorage.dump(modelState.MODEL_STORAGE_KEY));
assert.deepEqual(persisted, [
  { conversationId: 'conversation-two', modelId: MODEL_A },
  { conversationId: 'conversation-one', modelId: MODEL_A }
]);

// If an organizer marker exists, it is authoritative. Stale/invalid markers must not
// silently fall back to the DOM index because that can mutate another conversation.
for (const rows of [
  [row({ id: 'missing', active: true }), row({ id: 'conversation-two' })],
  [row({ active: true, marker: 'invalid' }), row({ id: 'conversation-two' })],
  [row({ active: true, marker: 'empty' }), row({ id: 'conversation-two' })]
]) {
  const documentRef = documentForRows(rows, MODEL_B);
  const storage = memoryStorage({
    [modelState.CONVERSATION_STORAGE_KEY]: JSON.stringify(conversations),
    [modelState.MODEL_STORAGE_KEY]: '[]'
  });
  const controller = controllerFor(documentRef, storage);
  const before = storage.writes();
  assert.equal(modelState.activeConversationId(documentRef, conversations), '');
  assert.equal(controller.persistSelection(), false);
  assert.equal(controller.restoreSelection(), false);
  assert.equal(storage.writes(), before);
}

// Duplicate organizer identities are ambiguous and fail closed.
const duplicateDocument = documentForRows([
  row({ id: 'conversation-two', active: true }),
  row({ id: 'conversation-two' })
], MODEL_B);
const duplicateStorage = memoryStorage({
  [modelState.CONVERSATION_STORAGE_KEY]: JSON.stringify(conversations),
  [modelState.MODEL_STORAGE_KEY]: '[]'
});
const duplicateController = controllerFor(duplicateDocument, duplicateStorage);
assert.equal(modelState.activeConversationId(duplicateDocument, conversations), '');
assert.equal(duplicateController.persistSelection(), false);
assert.equal(duplicateStorage.writes(), 0);

// Multiple active rows are also ambiguous regardless of organizer identity.
const multiActiveDocument = documentForRows([
  row({ id: 'conversation-one', active: true }),
  row({ id: 'conversation-two', active: true })
]);
assert.equal(modelState.activeConversationId(multiActiveDocument, conversations), '');

// Legacy surfaces without organizer data keep the original DOM-index behavior.
const legacyDocument = documentForRows([
  row({ active: false, marker: 'absent' }),
  row({ active: true, marker: 'absent' })
]);
assert.equal(
  modelState.activeConversationId(legacyDocument, conversations),
  'conversation-two'
);
const legacyStorage = memoryStorage({
  [modelState.CONVERSATION_STORAGE_KEY]: JSON.stringify(conversations),
  [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
    { conversationId: 'conversation-two', modelId: MODEL_B }
  ])
});
const legacyController = controllerFor(legacyDocument, legacyStorage);
assert.equal(legacyController.restoreSelection(), true);
assert.equal(legacyDocument.select.value, MODEL_B);

// Canonical duplicate IDs cannot authorize an organizer marker.
const duplicateCanonical = [
  { id: 'conversation-one', messages: [] },
  { id: 'conversation-one', messages: [] }
];
const duplicateCanonicalDocument = documentForRows([
  row({ id: 'conversation-one', active: true })
]);
assert.equal(
  modelState.activeConversationId(duplicateCanonicalDocument, duplicateCanonical),
  ''
);

console.log('conversation model row identity tests passed');
