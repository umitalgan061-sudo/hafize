import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modelState = require('../public/conversation-model-state.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    dump(key) { return values.get(key); }
  };
}

function fakeClassList(active = false) {
  return { contains(name) { return name === 'active' && active; } };
}

function fakeDocument({ activeIndex = 0, selectedModel = 'nvidia/meta/llama-3.1-70b-instruct' } = {}) {
  const listeners = new Map();
  const rows = [0, 1].map((index) => ({ classList: fakeClassList(index === activeIndex) }));
  const select = {
    value: selectedModel,
    disabled: false,
    options: [
      { value: 'nvidia/meta/llama-3.1-70b-instruct' },
      { value: 'local:qwen2.5:7b' }
    ],
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent() {},
  };
  const send = { classList: { contains() { return false; } } };
  const list = { querySelectorAll(selector) { return selector === '.conversation-row' ? rows : []; } };
  return {
    select,
    listeners,
    querySelector(selector) {
      if (selector === '#modelSelect') return select;
      if (selector === '#conversationList') return list;
      if (selector === '#sendBtn') return send;
      return null;
    }
  };
}

const conversations = [
  { id: 'conversation-one', createdAt: '2026-08-18T10:00:00.000Z', updatedAt: '2026-08-18T10:00:00.000Z', messages: [] },
  { id: 'conversation-two', createdAt: '2026-08-18T11:00:00.000Z', updatedAt: '2026-08-18T11:00:00.000Z', messages: [] }
];

assert.equal(modelState.MODEL_STORAGE_KEY, 'hafize.conversation-models.v1');
assert.equal(modelState.CONVERSATION_STORAGE_KEY, 'hafize.conversations.v1');
assert.equal(modelState.MAX_ENTRIES, 30);
assert.equal(modelState.normalizeConversationId('conversation-one'), 'conversation-one');
assert.equal(modelState.normalizeConversationId('../unsafe'), '');
assert.equal(modelState.normalizeConversationId('a'.repeat(121)), '');
assert.equal(modelState.normalizeModelId(' local:qwen2.5:7b '), 'local:qwen2.5:7b');
assert.equal(modelState.normalizeModelId('bad\nmodel'), '');
assert.equal(modelState.normalizeModelId('x'.repeat(241)), '');

const bounded = modelState.normalizeModelEntries([
  { conversationId: 'conversation-one', modelId: 'local:qwen2.5:7b', token: 'must-not-survive' },
  { conversationId: 'conversation-one', modelId: 'nvidia/duplicate' },
  { conversationId: 'missing', modelId: 'nvidia/missing' },
  { conversationId: '__proto__', modelId: 'nvidia/unsafe' }
], new Set(['conversation-one']));
assert.deepEqual(bounded, [{ conversationId: 'conversation-one', modelId: 'local:qwen2.5:7b' }]);
assert.equal(JSON.stringify(bounded).includes('token'), false);

const storage = memoryStorage({
  [modelState.CONVERSATION_STORAGE_KEY]: JSON.stringify(conversations),
  [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
    { conversationId: 'conversation-one', modelId: 'local:qwen2.5:7b', ownerId: 'secret-owner' },
    { conversationId: 'stale-conversation', modelId: 'nvidia/stale' }
  ])
});
assert.deepEqual(modelState.readModelEntries(storage, conversations), [
  { conversationId: 'conversation-one', modelId: 'local:qwen2.5:7b' }
]);
assert.equal(modelState.writeModelEntries(storage, [
  { conversationId: 'conversation-two', modelId: 'nvidia/meta/llama-3.1-70b-instruct' },
  { conversationId: 'stale-conversation', modelId: 'nvidia/stale' }
], conversations), true);
assert.deepEqual(JSON.parse(storage.dump(modelState.MODEL_STORAGE_KEY)), [
  { conversationId: 'conversation-two', modelId: 'nvidia/meta/llama-3.1-70b-instruct' }
]);
assert.deepEqual(JSON.parse(storage.dump(modelState.CONVERSATION_STORAGE_KEY)), conversations);

const documentRef = fakeDocument({ activeIndex: 0 });
const controllerStorage = memoryStorage({
  [modelState.CONVERSATION_STORAGE_KEY]: JSON.stringify(conversations)
});
const rootListeners = new Map();
const rootRef = {
  addEventListener(type, fn) { rootListeners.set(type, fn); },
  removeEventListener(type) { rootListeners.delete(type); }
};
const controller = modelState.createController({
  documentRef,
  storage: controllerStorage,
  rootRef,
  MutationObserverImpl: null,
  EventImpl: class FakeEvent { constructor(type) { this.type = type; } },
  queueMicrotaskImpl: (fn) => fn()
});
assert.equal(controller.mount(), true);
assert.deepEqual(JSON.parse(controllerStorage.dump(modelState.MODEL_STORAGE_KEY)), [
  { conversationId: 'conversation-one', modelId: 'nvidia/meta/llama-3.1-70b-instruct' }
]);

documentRef.select.value = 'local:qwen2.5:7b';
assert.equal(controller.persistSelection(), true);
assert.deepEqual(JSON.parse(controllerStorage.dump(modelState.MODEL_STORAGE_KEY)), [
  { conversationId: 'conversation-one', modelId: 'local:qwen2.5:7b' }
]);

controllerStorage.setItem(modelState.MODEL_STORAGE_KEY, JSON.stringify([
  { conversationId: 'conversation-one', modelId: 'nvidia/meta/llama-3.1-70b-instruct' }
]));
rootListeners.get('storage')?.({ key: modelState.MODEL_STORAGE_KEY });
assert.equal(documentRef.select.value, 'nvidia/meta/llama-3.1-70b-instruct');
assert.equal(controller.destroy(), true);
assert.equal(rootListeners.has('storage'), false);

const legacyStorage = memoryStorage({
  [modelState.CONVERSATION_STORAGE_KEY]: JSON.stringify([
    { ...conversations[0], modelId: 'local:qwen2.5:7b' },
    conversations[1]
  ])
});
const legacyDocument = fakeDocument({ activeIndex: 0 });
const legacyController = modelState.createController({
  documentRef: legacyDocument,
  storage: legacyStorage,
  rootRef: { addEventListener() {}, removeEventListener() {} },
  MutationObserverImpl: null,
  EventImpl: class FakeEvent { constructor(type) { this.type = type; } }
});
assert.equal(legacyController.restoreSelection(), true);
assert.equal(legacyDocument.select.value, 'local:qwen2.5:7b');
assert.deepEqual(JSON.parse(legacyStorage.dump(modelState.MODEL_STORAGE_KEY)), [
  { conversationId: 'conversation-one', modelId: 'local:qwen2.5:7b' }
]);

console.log('conversation model state storage tests passed');
