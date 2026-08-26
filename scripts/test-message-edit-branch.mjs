import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const editApi = require('../public/message-edit.js');
const guard = require('../public/conversation-storage-guard.js');
const modelState = require('../public/conversation-model-state.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    dump(key) { return values.get(String(key)); }
  };
}

function classList(names = []) {
  const set = new Set(names);
  return { contains(name) { return set.has(name); } };
}

function documentStub({ activeIndex = 0, draft = '', streaming = false } = {}) {
  const input = {
    value: draft,
    focused: false,
    selection: null,
    focus() { this.focused = true; },
    setSelectionRange(start, end) { this.selection = [start, end]; },
    dispatchEvent() { this.dispatched = true; }
  };
  const send = { classList: classList(streaming ? ['streaming'] : []) };
  const rows = [0, 1, 2].map((index) => ({ classList: classList(index === activeIndex ? ['active'] : []) }));
  const list = { querySelectorAll(selector) { return selector === '.conversation-row' ? rows : []; } };
  const userMessages = [];
  const messages = {
    querySelectorAll(selector) { return selector === '.message.user' ? userMessages : []; }
  };
  return {
    input,
    setUserMessages(items) {
      userMessages.splice(0, userMessages.length, ...(Array.isArray(items) ? items : []));
    },
    querySelector(selector) {
      if (selector === '#messageInput') return input;
      if (selector === '#sendBtn') return send;
      if (selector === '#conversationList') return list;
      if (selector === '#messages') return messages;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#conversationList .conversation-row') return rows;
      return [];
    },
    createElement() {
      return {
        dataset: {},
        className: '',
        textContent: '',
        disabled: false,
        parentNode: null,
        setAttribute() {},
        addEventListener(type, handler) { this.handler = handler; },
        removeEventListener() {},
        remove() { this.parentNode = null; }
      };
    }
  };
}

function editableArticle(text = 'Bunu daha ayrıntılı anlat.') {
  const content = { textContent: text };
  const actions = {
    button: null,
    prepend(button) {
      this.button = button;
      button.parentNode = this;
    },
    contains(button) { return this.button === button; }
  };
  const article = {
    dataset: { messageId: 'm-3' },
    classList: classList(['message', 'user']),
    querySelector(selector) {
      if (selector === '.content') return content;
      if (selector === '.message-copy-actions') return actions;
      if (selector === '.message-edit-btn') return null;
      return null;
    }
  };
  return { article, content, actions };
}

const source = guard.normalizeConversation({
  id: 'conversation-source',
  title: 'Araştırma konuşması',
  agentId: 'minimal-engineer',
  toolsEnabled: true,
  createdAt: '2026-08-18T10:00:00.000Z',
  updatedAt: '2026-08-18T10:04:00.000Z',
  messages: [
    { id: 'm-1', role: 'user', content: 'İlk sorum.', at: '2026-08-18T10:00:00.000Z' },
    { id: 'm-2', role: 'assistant', content: 'İlk yanıt.', at: '2026-08-18T10:01:00.000Z' },
    { id: 'm-3', role: 'user', content: 'Bunu daha ayrıntılı anlat.', at: '2026-08-18T10:02:00.000Z' },
    { id: 'm-4', role: 'assistant', content: 'Ayrıntılı yanıt.', at: '2026-08-18T10:04:00.000Z' }
  ]
});

assert.equal(editApi.editableText('  merhaba\r\ndünya  '), '  merhaba\ndünya  ');
assert.equal(editApi.editableText('\u0000'), null);
assert.equal(editApi.editableText('x'.repeat(editApi.MAX_COMPOSER_CHARS + 1)), null);
assert.equal(editApi.editBranchTitle('A'.repeat(100), 80).length <= 80, true);
assert.equal(editApi.findSource([source], 'm-3')?.index, 2);
assert.equal(editApi.findSource([source, source], 'm-3'), null, 'ambiguous message ids fail closed');
assert.equal(editApi.findSource([source], 'm-4'), null);

let sequence = 0;
const built = editApi.buildEditBranch(source, 2, {
  nowIso: '2026-08-19T00:30:00.000Z',
  makeId(prefix) { sequence += 1; return `${prefix}-edit-${sequence}`; }
});
assert.ok(built);
assert.equal(built.messages.length, 2, 'selected user turn must not be copied into branch history');
assert.equal(built.messages[0].content, 'İlk sorum.');
assert.equal(built.messages[1].content, 'İlk yanıt.');
assert.notEqual(built.messages[0].id, source.messages[0].id);
assert.equal(built.agentId, source.agentId);
assert.equal(built.toolsEnabled, true);
assert.equal(guard.normalizeConversation(built)?.id, built.id);
assert.equal(editApi.buildEditBranch(source, 3, { nowIso: '2026-08-19T00:30:00.000Z', makeId: () => 'x' }), null);

const createdAt = Date.parse('2026-08-19T00:30:00.000Z');
assert.deepEqual(editApi.normalizeHandoff({ conversationId: 'conversation-x', text: 'taslak', createdAt }, { nowMs: createdAt + 1000 }), {
  conversationId: 'conversation-x', text: 'taslak', createdAt
});
assert.equal(editApi.normalizeHandoff({ conversationId: 'conversation-x', text: 'taslak', createdAt }, { nowMs: createdAt + editApi.MAX_HANDOFF_AGE_MS + 1 }), null);
assert.equal(editApi.normalizeHandoff({ conversationId: '../bad', text: 'taslak', createdAt }, { nowMs: createdAt + 1 }), null);

const storage = memoryStorage({
  [editApi.STORAGE_KEY]: JSON.stringify([source]),
  [modelState.MODEL_STORAGE_KEY]: JSON.stringify([{ conversationId: source.id, modelId: 'local:qwen2.5:7b' }])
});
const handoffStorage = memoryStorage();
const doc = documentStub();
const editFixture = editableArticle();
doc.setUserMessages([editFixture.article]);
let reloads = 0;
let uuid = 0;
const cryptoRef = { randomUUID() { uuid += 1; return `00000000-0000-4000-8000-${String(uuid).padStart(12, '0')}`; } };
const controller = editApi.createController({
  documentRef: doc,
  storage,
  handoffStorage,
  guard,
  modelState,
  MutationObserverImpl: null,
  cryptoRef,
  now: () => new Date(createdAt),
  reload: () => { reloads += 1; }
});
assert.equal(controller.mount(), true);
const button = editFixture.actions.button;
const article = editFixture.article;
const content = editFixture.content;
assert.ok(button);
assert.equal(controller.editMessage(button, article, content), true);
assert.equal(reloads, 1);
assert.equal(button.dataset.state, 'success');
const persisted = guard.sanitizeStoredValue(storage.dump(editApi.STORAGE_KEY)).value;
assert.equal(persisted.length, 2);
const branch = persisted.find((conversation) => conversation.id !== source.id);
assert.ok(branch);
assert.equal(branch.messages.length, 2);
assert.equal(persisted.find((conversation) => conversation.id === source.id).messages.length, 4, 'source remains untouched');
const staged = JSON.parse(handoffStorage.dump(editApi.DRAFT_HANDOFF_KEY));
assert.equal(staged.conversationId, branch.id);
assert.equal(staged.text, content.textContent);
const models = modelState.readModelEntries(storage, persisted);
assert.equal(models.find((entry) => entry.conversationId === branch.id)?.modelId, 'local:qwen2.5:7b');

const restoreDoc = documentStub({ activeIndex: 0 });
const restoreController = editApi.createController({
  documentRef: restoreDoc,
  storage,
  handoffStorage,
  guard,
  modelState,
  MutationObserverImpl: null
});
assert.equal(restoreController.mount(), true);
assert.equal(restoreDoc.input.value, content.textContent);
assert.equal(restoreDoc.input.focused, true);
assert.deepEqual(restoreDoc.input.selection, [content.textContent.length, content.textContent.length]);
assert.equal(handoffStorage.getItem(editApi.DRAFT_HANDOFF_KEY), null, 'handoff must be one-shot');

const draftStorage = memoryStorage({ [editApi.STORAGE_KEY]: JSON.stringify([source]) });
const draftHandoff = memoryStorage();
const draftDoc = documentStub({ draft: 'mevcut taslak' });
const draftFixture = editableArticle();
draftDoc.setUserMessages([draftFixture.article]);
const draftController = editApi.createController({
  documentRef: draftDoc,
  storage: draftStorage,
  handoffStorage: draftHandoff,
  guard,
  modelState,
  MutationObserverImpl: null,
  cryptoRef,
  now: () => new Date(createdAt),
  reload: () => { throw new Error('must not reload'); }
});
assert.equal(draftController.mount(), true);
const draftButton = draftFixture.actions.button;
assert.ok(draftButton);
assert.equal(draftController.editMessage(draftButton, draftFixture.article, draftFixture.content), false);
assert.equal(draftButton.textContent, 'Taslak korunuyor');
assert.equal(guard.sanitizeStoredValue(draftStorage.dump(editApi.STORAGE_KEY)).value.length, 1);
assert.equal(draftHandoff.getItem(editApi.DRAFT_HANDOFF_KEY), null);

const streamDoc = documentStub({ streaming: true });
const streamFixture = editableArticle();
streamDoc.setUserMessages([streamFixture.article]);
const streamController = editApi.createController({
  documentRef: streamDoc,
  storage: memoryStorage({ [editApi.STORAGE_KEY]: JSON.stringify([source]) }),
  handoffStorage: memoryStorage(),
  guard,
  modelState,
  MutationObserverImpl: null
});
assert.equal(streamController.mount(), true);
const streamButton = streamFixture.actions.button;
assert.ok(streamButton);
assert.equal(streamController.editMessage(streamButton, streamFixture.article, streamFixture.content), false);
assert.equal(streamButton.textContent, 'Yanıt sürüyor');

const inactiveDoc = documentStub({ activeIndex: 1 });
const inactiveFixture = editableArticle();
inactiveDoc.setUserMessages([inactiveFixture.article]);
const inactiveController = editApi.createController({
  documentRef: inactiveDoc,
  storage: memoryStorage({ [editApi.STORAGE_KEY]: JSON.stringify([source]) }),
  handoffStorage: memoryStorage(),
  guard,
  modelState,
  MutationObserverImpl: null
});
assert.equal(inactiveController.mount(), true);
const inactiveButton = inactiveFixture.actions.button;
assert.ok(inactiveButton);
assert.equal(inactiveController.editMessage(inactiveButton, inactiveFixture.article, inactiveFixture.content), false, 'historical DOM mismatch must fail closed');

console.log('message edit branch tests passed');