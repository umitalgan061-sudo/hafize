import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

function row({ organizedId = '', conversationId = '', active = false } = {}) {
  const dataset = {};
  if (organizedId) dataset.conversationOrganizeId = organizedId;
  if (conversationId) dataset.conversationId = conversationId;
  return {
    dataset,
    classList: { contains: (name) => name === 'active' && active },
    querySelector: () => null
  };
}

const conversations = [
  { id: 'recent', messages: [] },
  { id: 'pinned', messages: [] },
  { id: 'older', messages: [] }
];
const rows = [
  row({ organizedId: 'pinned', active: true }),
  row({ organizedId: 'recent' }),
  row({ organizedId: 'older' })
];
const storage = {
  values: new Map([
    ['hafize.conversations.v1', JSON.stringify(conversations)],
    ['hafize.conversation-branches.v1', JSON.stringify([
      {
        childConversationId: 'pinned',
        parentConversationId: 'older',
        sourceMessageId: 'msg-1',
        mode: 'fork',
        createdAt: '2026-08-19T00:00:00.000Z'
      }
    ])]
  ]),
  getItem(key) { return this.values.get(key) || null; },
  setItem(key, value) { this.values.set(key, value); }
};
const guard = {
  sanitizeStoredValue(raw) { return { value: JSON.parse(raw) }; }
};
const documentRef = {
  head: { append() {} },
  getElementById() { return null; },
  createElement() { return { setAttribute() {}, append() {}, addEventListener() {}, remove() {}, style: {}, className: '', hidden: false }; },
  querySelector(selector) {
    if (selector === '#conversationList') return null;
    if (selector === '.chat-stage') return null;
    return null;
  },
  querySelectorAll(selector) {
    return selector === '#conversationList .conversation-row' ? rows : [];
  },
  addEventListener() {},
  removeEventListener() {}
};
const controller = api.createController({
  documentRef,
  storage,
  guard,
  MutationObserverImpl: null,
  windowRef: { addEventListener() {}, removeEventListener() {} }
});

controller.annotateRows(conversations);
assert.deepEqual(rows.map((item) => item.dataset.conversationId), ['pinned', 'recent', 'older']);
assert.equal(controller.activeConversationId(), 'pinned');
assert.equal(controller.currentEntry()?.childConversationId, 'pinned');
assert.equal(controller.currentEntry()?.parentConversationId, 'older');

const duplicateRows = [
  row({ organizedId: 'pinned' }),
  row({ organizedId: 'pinned' }),
  row({ organizedId: 'older' })
];
documentRef.querySelectorAll = (selector) => selector === '#conversationList .conversation-row' ? duplicateRows : [];
controller.annotateRows(conversations);
assert.equal(duplicateRows[0].dataset.conversationId, 'pinned');
assert.equal(duplicateRows[1].dataset.conversationId, 'recent');
assert.equal(duplicateRows[2].dataset.conversationId, 'older');
assert.equal(new Set(duplicateRows.map((item) => item.dataset.conversationId)).size, 3);

const staleRows = [
  row({ organizedId: 'missing', conversationId: 'missing' }),
  row({ organizedId: 'recent' }),
  row({ organizedId: 'older' })
];
documentRef.querySelectorAll = (selector) => selector === '#conversationList .conversation-row' ? staleRows : [];
controller.annotateRows(conversations);
assert.equal(staleRows[0].dataset.conversationId, 'pinned');
assert.equal(staleRows[1].dataset.conversationId, 'recent');
assert.equal(staleRows[2].dataset.conversationId, 'older');

const legacyRows = [row(), row(), row()];
documentRef.querySelectorAll = (selector) => selector === '#conversationList .conversation-row' ? legacyRows : [];
controller.annotateRows(conversations);
assert.deepEqual(legacyRows.map((item) => item.dataset.conversationId), ['recent', 'pinned', 'older']);

console.log('conversation lineage row identity tests passed');
