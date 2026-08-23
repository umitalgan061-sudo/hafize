import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const forkApi = require('../public/conversation-fork.js');
const editApi = require('../public/message-edit.js');
const guard = require('../public/conversation-storage-guard.js');

function conversation(index, { source = false } = {}) {
  const minute = String(index).padStart(2, '0');
  const stamp = `2026-08-18T10:${minute}:00.000Z`;
  return guard.normalizeConversation({
    id: source ? 'conversation-source' : `conversation-${index}`,
    title: source ? 'Kaynak sohbet' : `Sohbet ${index}`,
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: stamp,
    updatedAt: stamp,
    messages: [
      { id: source ? 'source-user' : `u-${index}`, role: 'user', content: `soru-${index}`, at: stamp },
      { id: source ? 'source-assistant' : `a-${index}`, role: 'assistant', content: `yanit-${index}`, at: stamp }
    ]
  });
}

function fullHistoryWithOldestSource() {
  const newer = [];
  for (let index = 29; index >= 1; index -= 1) newer.push(conversation(index));
  const source = guard.normalizeConversation({
    id: 'conversation-source',
    title: 'Kaynak sohbet',
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-08-18T09:00:00.000Z',
    messages: [
      { id: 'source-user', role: 'user', content: 'Kaynak soru', at: '2026-08-18T09:00:00.000Z' },
      { id: 'source-assistant', role: 'assistant', content: 'Kaynak yanıt', at: '2026-08-18T09:01:00.000Z' }
    ]
  });
  const canonical = guard.normalizeConversations([...newer, source]);
  assert.equal(canonical.length, guard.MAX_CONVERSATIONS);
  assert.equal(canonical.at(-1).id, source.id);
  return { canonical, source };
}

function memoryStorage(initial) {
  const values = new Map([[guard.STORAGE_KEY, JSON.stringify(initial)]]);
  let writes = 0;
  return {
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) { writes += 1; values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    writes() { return writes; },
    value() { return guard.sanitizeStoredValue(values.get(guard.STORAGE_KEY) || '[]').value; }
  };
}

function classList(active = false) {
  return { contains(name) { return name === 'active' && active; } };
}

function forkDocument() {
  return {
    querySelector(selector) {
      if (selector === '#messageInput') return { value: '' };
      if (selector === '#sendBtn') return { classList: classList(false) };
      if (selector === '#messages') return { querySelectorAll() { return []; } };
      return null;
    }
  };
}

function editDocument(conversations, activeId) {
  const rows = conversations.map((item) => ({
    classList: classList(item.id === activeId),
    dataset: { conversationOrganizeId: item.id }
  }));
  const input = { value: '', focus() {}, dispatchEvent() {}, setSelectionRange() {} };
  const list = { querySelectorAll(selector) { return selector === '.conversation-row' ? rows : []; } };
  return {
    querySelector(selector) {
      if (selector === '#messageInput') return input;
      if (selector === '#sendBtn') return { classList: classList(false) };
      if (selector === '#conversationList') return list;
      if (selector === '#messages') return { querySelectorAll() { return []; } };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#conversationList .conversation-row') return rows;
      return [];
    }
  };
}

function cryptoSequence() {
  let counter = 0;
  return {
    randomUUID() {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    }
  };
}

function button() {
  return { dataset: {}, textContent: '', disabled: false };
}

assert.equal(forkApi.SOURCE_RETENTION_ERROR, 'Kaynak korunamıyor');
assert.equal(editApi.SOURCE_RETENTION_ERROR, 'Kaynak korunamıyor');
assert.equal(forkApi.includesConversationIds([{ id: 'a' }, { id: 'b' }], 'a', 'b'), true);
assert.equal(forkApi.includesConversationIds([{ id: 'a' }], 'a', 'b'), false);
assert.equal(editApi.includesConversationIds([{ id: 'a' }, { id: 'b' }], 'a', 'b'), true);
assert.equal(editApi.includesConversationIds([{ id: 'a' }], 'a', 'a'), false, 'duplicate required ids fail closed');

{
  const { canonical, source } = fullHistoryWithOldestSource();
  const storage = memoryStorage(canonical);
  let reloads = 0;
  const controller = forkApi.createController({
    documentRef: forkDocument(),
    storage,
    guard,
    modelState: null,
    MutationObserverImpl: null,
    cryptoRef: cryptoSequence(),
    now: () => new Date('2026-08-19T08:00:00.000Z'),
    reload: () => { reloads += 1; }
  });
  assert.equal(controller.mount(), true);
  const action = button();
  assert.equal(controller.forkFromMessage(action, 'source-assistant'), false);
  assert.equal(action.dataset.state, 'error');
  assert.equal(action.textContent, forkApi.SOURCE_RETENTION_ERROR);
  assert.equal(storage.writes(), 0, 'retention rejection must happen before persistent mutation');
  assert.equal(storage.value().length, guard.MAX_CONVERSATIONS);
  assert.ok(storage.value().some((item) => item.id === source.id));
  assert.equal(reloads, 0);
}

{
  const { canonical, source } = fullHistoryWithOldestSource();
  const storage = memoryStorage(canonical);
  const handoff = memoryStorage([]);
  let reloads = 0;
  const controller = editApi.createController({
    documentRef: editDocument(canonical, source.id),
    storage,
    handoffStorage: handoff,
    guard,
    modelState: require('../public/conversation-model-state.js'),
    MutationObserverImpl: null,
    cryptoRef: cryptoSequence(),
    now: () => new Date('2026-08-19T08:00:00.000Z'),
    reload: () => { reloads += 1; }
  });
  const action = button();
  const article = { dataset: { messageId: 'source-user' } };
  const content = { textContent: 'Kaynak soru' };
  assert.equal(controller.editMessage(action, article, content), false);
  assert.equal(action.dataset.state, 'error');
  assert.equal(action.textContent, editApi.SOURCE_RETENTION_ERROR);
  assert.equal(storage.writes(), 0, 'edit branch must not mutate canonical history when source would be evicted');
  assert.equal(handoff.getItem(editApi.DRAFT_HANDOFF_KEY), null, 'rejected branch must clear staged one-shot draft');
  assert.ok(storage.value().some((item) => item.id === source.id));
  assert.equal(reloads, 0);
}

{
  const { canonical, source } = fullHistoryWithOldestSource();
  const branch = guard.normalizeConversation({
    id: 'conversation-new-branch',
    title: 'Yeni dal',
    agentId: source.agentId,
    toolsEnabled: source.toolsEnabled,
    createdAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-19T08:00:00.000Z',
    messages: []
  });
  const candidate = guard.normalizeConversations([branch, ...canonical]);
  assert.equal(candidate.length, guard.MAX_CONVERSATIONS);
  assert.ok(candidate.some((item) => item.id === branch.id));
  assert.equal(candidate.some((item) => item.id === source.id), false,
    'regression fixture must reproduce the original retention data-loss condition');
}

{
  const { canonical, source } = fullHistoryWithOldestSource();
  const values = new Map([[guard.STORAGE_KEY, JSON.stringify(canonical.slice(0, -1))]]);
  values.set(guard.STORAGE_KEY, JSON.stringify([source, ...canonical.filter((item) => item.id !== source.id).slice(0, 5)]));
  let firstBranchWrite = true;
  const racingStorage = {
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, raw) {
      const parsed = guard.sanitizeStoredValue(String(raw)).value;
      if (firstBranchWrite && parsed.some((item) => item.id.startsWith('conversation-00000000'))) {
        firstBranchWrite = false;
        values.set(String(key), JSON.stringify(parsed.filter((item) => item.id !== source.id)));
        return;
      }
      values.set(String(key), JSON.stringify(parsed));
    }
  };
  const controller = forkApi.createController({
    documentRef: forkDocument(),
    storage: racingStorage,
    guard,
    modelState: null,
    MutationObserverImpl: null,
    cryptoRef: cryptoSequence(),
    now: () => new Date('2026-08-19T08:00:00.000Z'),
    reload: () => { throw new Error('orphan race must not reload'); }
  });
  const action = button();
  assert.equal(controller.forkFromMessage(action, 'source-assistant'), false);
  const finalState = guard.sanitizeStoredValue(racingStorage.getItem(guard.STORAGE_KEY)).value;
  assert.equal(finalState.some((item) => item.id.startsWith('conversation-00000000')), false,
    'new orphan fork is rolled back when source disappears during persistence');
}

console.log('conversation branch source retention tests passed');
