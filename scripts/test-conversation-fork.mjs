import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const forkApi = require('../public/conversation-fork.js');
const guard = require('../public/conversation-storage-guard.js');
const modelState = require('../public/conversation-model-state.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    dump(key) { return values.get(key); }
  };
}

function classList(names = []) {
  const set = new Set(names);
  return { contains(name) { return set.has(name); } };
}

function buttonStub() {
  return { dataset: {}, textContent: '', disabled: false };
}

function documentStub({ draft = '', streaming = false } = {}) {
  const input = { value: draft };
  const send = { classList: classList(streaming ? ['streaming'] : []) };
  return {
    head: { append() {} },
    querySelector(selector) {
      if (selector === '#messageInput') return input;
      if (selector === '#sendBtn') return send;
      if (selector === '#messages') return { querySelectorAll() { return []; } };
      if (selector === `#${forkApi.STYLE_ID}`) return null;
      return null;
    },
    createElement() { return { setAttribute() {}, addEventListener() {}, append() {}, dataset: {}, className: '', textContent: '' }; }
  };
}

const source = {
  id: 'conversation-source',
  title: 'Derin araştırma',
  agentId: 'minimal-engineer',
  toolsEnabled: true,
  createdAt: '2026-08-18T10:00:00.000Z',
  updatedAt: '2026-08-18T10:03:00.000Z',
  messages: [
    { id: 'm-1', role: 'user', content: 'Bir plan yap.', at: '2026-08-18T10:00:00.000Z' },
    { id: 'm-2', role: 'assistant', content: 'İlk plan.', at: '2026-08-18T10:01:00.000Z' },
    { id: 'm-3', role: 'user', content: 'Derinleştir.', at: '2026-08-18T10:02:00.000Z' },
    { id: 'm-4', role: 'assistant', content: 'Derin plan.', at: '2026-08-18T10:03:00.000Z', toolActivities: [{ label: 'Araştırma', state: 'success' }] }
  ]
};

assert.equal(forkApi.forkTitle('A'.repeat(100), 80).length <= 80, true);
assert.equal(forkApi.forkTitle('', 80), 'Yeni sohbet · dal');
assert.deepEqual(forkApi.findSource([source], 'm-4'), { conversation: source, index: 3 });
assert.equal(forkApi.findSource([source, source], 'm-4'), null);
assert.equal(forkApi.findSource([source], 'm-3'), null, 'user turn must not be a fork target');

let idCounter = 0;
const built = forkApi.buildFork(source, 1, {
  nowIso: '2026-08-19T00:00:00.000Z',
  makeId(prefix) { idCounter += 1; return `${prefix}-fork-${idCounter}`; }
});
assert.equal(built.id.startsWith('conversation-fork-'), true);
assert.equal(built.messages.length, 2);
assert.equal(built.messages[1].content, 'İlk plan.');
assert.notEqual(built.messages[0].id, source.messages[0].id);
assert.equal(built.agentId, source.agentId);
assert.equal(built.toolsEnabled, true);
assert.equal(built.title, 'Derin araştırma · dal');
assert.equal(guard.normalizeConversation(built)?.id, built.id);
assert.equal(forkApi.buildFork(source, 0, { nowIso: '2026-08-19T00:00:00.000Z', makeId: () => 'x' }), null);

const canonicalSource = guard.normalizeConversation(source);
const storage = memoryStorage({
  [forkApi.STORAGE_KEY]: JSON.stringify([canonicalSource]),
  [modelState.MODEL_STORAGE_KEY]: JSON.stringify([
    { conversationId: source.id, modelId: 'local:qwen2.5:7b' }
  ])
});
let reloads = 0;
let sequence = 0;
const cryptoRef = {
  randomUUID() { sequence += 1; return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`; }
};
const controller = forkApi.createController({
  documentRef: documentStub(),
  storage,
  guard,
  modelState,
  MutationObserverImpl: null,
  cryptoRef,
  now: () => new Date('2026-08-19T00:05:00.000Z'),
  reload: () => { reloads += 1; }
});
const successButton = buttonStub();
assert.equal(controller.forkFromMessage(successButton, 'm-2'), true);
assert.equal(reloads, 1);
const persisted = guard.sanitizeStoredValue(storage.dump(forkApi.STORAGE_KEY)).value;
assert.equal(persisted.length, 2);
const forked = persisted.find((conversation) => conversation.id !== source.id);
assert.ok(forked);
assert.equal(forked.messages.length, 2);
assert.equal(forked.messages[1].content, 'İlk plan.');
assert.equal(persisted.find((conversation) => conversation.id === source.id).messages.length, 4, 'source must remain untouched');
const modelEntries = modelState.readModelEntries(storage, persisted);
assert.equal(modelEntries.find((entry) => entry.conversationId === forked.id)?.modelId, 'local:qwen2.5:7b');
assert.equal(successButton.dataset.state, 'success');

const draftStorage = memoryStorage({ [forkApi.STORAGE_KEY]: JSON.stringify([canonicalSource]) });
const draftController = forkApi.createController({
  documentRef: documentStub({ draft: 'gönderilmemiş taslak' }),
  storage: draftStorage,
  guard,
  modelState,
  MutationObserverImpl: null,
  cryptoRef,
  now: () => new Date('2026-08-19T00:05:00.000Z'),
  reload: () => { throw new Error('must not reload'); }
});
const draftButton = buttonStub();
assert.equal(draftController.forkFromMessage(draftButton, 'm-2'), false);
assert.equal(draftButton.textContent, 'Taslak korunuyor');
assert.equal(guard.sanitizeStoredValue(draftStorage.dump(forkApi.STORAGE_KEY)).value.length, 1);

const streamController = forkApi.createController({
  documentRef: documentStub({ streaming: true }),
  storage: memoryStorage({ [forkApi.STORAGE_KEY]: JSON.stringify([canonicalSource]) }),
  guard,
  modelState,
  MutationObserverImpl: null,
  cryptoRef
});
const streamButton = buttonStub();
assert.equal(streamController.forkFromMessage(streamButton, 'm-2'), false);
assert.equal(streamButton.textContent, 'Yanıt sürüyor');

assert.equal(forkApi.STYLE_TEXT.includes('localStorage'), false);
assert.equal(forkApi.STYLE_TEXT.includes('fetch('), false);
console.log('conversation fork tests passed');
