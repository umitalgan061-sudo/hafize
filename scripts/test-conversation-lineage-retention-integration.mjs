import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

function node() {
  return {
    id: '', className: '', hidden: false, type: '', textContent: '', dataset: {}, children: [],
    setAttribute() {}, addEventListener() {}, removeEventListener() {},
    append(...items) { this.children.push(...items); },
    prepend(...items) { this.children.unshift(...items); },
    remove() { this.removed = true; },
    querySelector() { return null; }
  };
}

const stage = node();
const listNode = node();
const head = node();
let rows = [
  { dataset: { conversationId: 'root', conversationOrganizeId: 'root' }, classList: { contains: () => false }, querySelector: () => null },
  { dataset: { conversationId: 'child', conversationOrganizeId: 'child' }, classList: { contains: (name) => name === 'active' }, querySelector: () => null }
];
const documentRef = {
  head,
  createElement: () => node(),
  getElementById: () => null,
  querySelector(selector) {
    if (selector === '.chat-stage') return stage;
    if (selector === '#conversationList') return listNode;
    return null;
  },
  querySelectorAll(selector) { return selector === '#conversationList .conversation-row' ? rows : []; },
  addEventListener() {},
  removeEventListener() {}
};

const lineage = {
  childConversationId: 'child',
  parentConversationId: 'root',
  sourceMessageId: 'm1',
  mode: 'fork',
  createdAt: '2026-08-19T00:00:00.000Z'
};
const values = new Map([
  [api.CONVERSATION_KEY, JSON.stringify([{ id: 'root', messages: [] }, { id: 'child', messages: [] }])],
  [api.STORAGE_KEY, JSON.stringify([lineage])]
]);
const writes = [];
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem(key, value) {
    writes.push([key, String(value)]);
    values.set(key, String(value));
  }
};
const guard = { sanitizeStoredValue: (raw) => ({ value: JSON.parse(raw) }) };
let observerCallback = null;
class Observer {
  constructor(callback) { observerCallback = callback; }
  observe() {}
  disconnect() {}
}
const windowListeners = new Map();
const windowRef = {
  addEventListener(name, handler) { windowListeners.set(name, handler); },
  removeEventListener(name) { windowListeners.delete(name); }
};

const controller = api.createController({ documentRef, storage, guard, MutationObserverImpl: Observer, windowRef });
assert.equal(controller.mount(), true);
assert.equal(controller.readEntries().length, 1);
assert.equal(writes.length, 0, 'canonical lineage must not be rewritten on mount');

// Same-tab delete: app updates conversation storage and rerenders the list. Storage events do not fire in the same tab,
// so the MutationObserver render path must compact the now-stale lineage relation.
values.set(api.CONVERSATION_KEY, JSON.stringify([{ id: 'root', messages: [] }]));
rows = [
  { dataset: { conversationId: 'root', conversationOrganizeId: 'root' }, classList: { contains: () => false }, querySelector: () => null }
];
observerCallback?.([]);
assert.equal(controller.readEntries().length, 0);
assert.equal(values.get(api.STORAGE_KEY), '[]');
assert.equal(writes.length, 1);

// Repeated rerenders after cleanup must not churn localStorage.
observerCallback?.([]);
observerCallback?.([]);
assert.equal(writes.length, 1);

// A cross-tab conversation update uses the same bounded render/compaction path.
values.set(api.CONVERSATION_KEY, JSON.stringify([]));
windowListeners.get('storage')?.({ key: api.CONVERSATION_KEY });
assert.equal(controller.readEntries().length, 0);
assert.equal(writes.length, 1, 'already-empty lineage is not rewritten');

controller.destroy();
assert.equal(windowListeners.has('storage'), false);

console.log('conversation lineage retention integration tests passed');
