import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const retry = require('../public/response-retry.js');
const edit = require('../public/message-edit.js');
const guard = require('../public/conversation-storage-guard.js');
const modelState = require('../public/conversation-model-state.js');

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    dump(key) { return values.get(String(key)); }
  };
}

function classes(...values) {
  const set = new Set(values);
  return { contains(name) { return set.has(name); } };
}

const source = guard.normalizeConversation({
  id: 'conversation-source',
  title: 'Uzun araştırma',
  agentId: 'minimal-engineer',
  toolsEnabled: true,
  createdAt: '2026-08-18T20:00:00.000Z',
  updatedAt: '2026-08-18T20:04:00.000Z',
  messages: [
    { id: 'u-1', role: 'user', content: 'İlk soruyu araştır.', at: '2026-08-18T20:00:00.000Z' },
    { id: 'a-1', role: 'assistant', content: 'İlk yanıt.', at: '2026-08-18T20:01:00.000Z' },
    { id: 'u-2', role: 'user', content: 'İkinci soruyu daha derin araştır.', at: '2026-08-18T20:02:00.000Z' },
    { id: 'a-2', role: 'assistant', content: 'İkinci yanıt.', at: '2026-08-18T20:04:00.000Z' }
  ]
});

const localStorage = storage({
  [edit.STORAGE_KEY]: JSON.stringify([source]),
  [modelState.MODEL_STORAGE_KEY]: JSON.stringify([{ conversationId: source.id, modelId: 'meta/llama-3.1-70b-instruct' }])
});
const sessionStorage = storage();
const input = { value: '', focus() {}, setSelectionRange() {}, dispatchEvent() {} };
const send = { classList: classes() };
const list = { querySelectorAll() { return [{ classList: classes('active') }]; } };
const documentRef = {
  querySelector(selector) {
    if (selector === '#messageInput') return input;
    if (selector === '#sendBtn') return send;
    if (selector === '#conversationList') return list;
    if (selector === '#messages') return { querySelectorAll() { return []; } };
    return null;
  },
  querySelectorAll(selector) {
    if (selector === '#conversationList .conversation-row') return [{ classList: classes('active') }];
    return [];
  }
};

let reloads = 0;
let sequence = 0;
const editController = edit.createController({
  documentRef,
  storage: localStorage,
  handoffStorage: sessionStorage,
  guard,
  modelState,
  MutationObserverImpl: null,
  EventImpl: class FakeEvent { constructor(type) { this.type = type; } },
  cryptoRef: { randomUUID() { sequence += 1; return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`; } },
  now: () => new Date('2026-08-19T01:00:00.000Z'),
  reload: () => { reloads += 1; }
});

function retryHistorical(messageId, prompt) {
  const content = { textContent: prompt };
  const editButton = {
    dataset: {},
    textContent: 'Düzenle',
    disabled: false,
    clickCount: 0,
    click() {
      this.clickCount += 1;
      editController.editMessage(this, { dataset: { messageId } }, content);
    }
  };
  const user = { querySelector(selector) { return selector === '.message-edit-btn' ? editButton : null; } };
  const retryController = retry.createController({ documentRef, MutationObserverImpl: null });
  const ok = retryController.prepareRetryBranch({ user, userMessageId: messageId, prompt });
  return { ok, editButton };
}

const historical = retryHistorical('u-1', 'İlk soruyu araştır.');
assert.equal(historical.ok, true);
assert.equal(historical.editButton.clickCount, 1);
assert.equal(reloads, 1);
assert.equal(input.value, '', 'retry must not submit or mutate composer before reload');

const persisted = guard.sanitizeStoredValue(localStorage.dump(edit.STORAGE_KEY)).value;
assert.equal(persisted.length, 2);
const original = persisted.find((item) => item.id === source.id);
const branch = persisted.find((item) => item.id !== source.id);
assert.ok(original && branch);
assert.equal(original.messages.length, 4, 'source conversation must remain untouched');
assert.equal(branch.messages.length, 0, 'retrying the first user turn must branch before that turn');
assert.equal(branch.agentId, source.agentId);
assert.equal(branch.toolsEnabled, true);

const handoff = JSON.parse(sessionStorage.dump(edit.DRAFT_HANDOFF_KEY));
assert.equal(handoff.conversationId, branch.id);
assert.equal(handoff.text, 'İlk soruyu araştır.');
assert.equal(typeof handoff.createdAt, 'number');
assert.equal(Object.keys(handoff).sort().join(','), 'conversationId,createdAt,text', 'handoff must contain only bounded draft metadata');

const modelEntries = modelState.readModelEntries(localStorage, persisted);
assert.equal(modelEntries.find((entry) => entry.conversationId === branch.id)?.modelId, 'meta/llama-3.1-70b-instruct');

const blockedInput = input.value;
input.value = 'Gönderilmemiş yeni taslak';
const blocked = retryHistorical('u-2', 'İkinci soruyu daha derin araştır.');
assert.equal(blocked.ok, false, 'existing composer draft must block historical retry');
assert.equal(blocked.editButton.clickCount, 0);
assert.equal(reloads, 1);
assert.equal(input.value, 'Gönderilmemiş yeni taslak');
input.value = blockedInput;

console.log('response retry and edit branch integration tests passed');
