import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

function classes(initial = []) {
  const set = new Set(initial);
  return { contains: (name) => set.has(name), add: (name) => set.add(name), remove: (name) => set.delete(name) };
}

function node(tag = 'div') {
  const listeners = new Map();
  return {
    tag,
    dataset: {},
    className: '',
    classList: classes(),
    hidden: false,
    textContent: '',
    children: [],
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); },
    append(...items) { this.children.push(...items); },
    prepend(item) { this.children.unshift(item); },
    remove() { this.removed = true; },
    click() { listeners.get('click')?.({}); },
    querySelector(selector) { return selector === '.conversation-open' ? this.openButton || null : null; }
  };
}

const conversations = [
  { id: 'child-1', title: 'Dal', messages: [] },
  { id: 'parent-1', title: 'Kaynak', messages: [{ id: 'message-1' }] }
];
let conversationRaw = JSON.stringify(conversations);
const values = new Map([['hafize.conversations.v1', conversationRaw]]);
const storage = {
  getItem(key) { return values.get(key) ?? null; },
  setItem(key, value) { values.set(key, String(value)); }
};
const guard = {
  sanitizeStoredValue(raw) { return { value: JSON.parse(raw) }; }
};

const childRow = node();
childRow.classList = classes(['conversation-row', 'active']);
childRow.openButton = node('button');
const parentRow = node();
parentRow.classList = classes(['conversation-row']);
parentRow.openButton = node('button');
let parentClicks = 0;
parentRow.openButton.click = () => { parentClicks += 1; };
const rows = [childRow, parentRow];
const stage = node('section');
const head = node('head');
const docListeners = new Map();
const documentRef = {
  head,
  createElement: node,
  getElementById() { return null; },
  querySelector(selector) {
    if (selector === '.chat-stage') return stage;
    if (selector === '#conversationList') return node();
    return null;
  },
  querySelectorAll(selector) { return selector === '#conversationList .conversation-row' ? rows : []; },
  addEventListener(name, fn) { docListeners.set(name, fn); },
  removeEventListener(name, fn) { if (docListeners.get(name) === fn) docListeners.delete(name); }
};
const windowListeners = new Map();
const windowRef = {
  addEventListener(name, fn) { windowListeners.set(name, fn); },
  removeEventListener(name, fn) { if (windowListeners.get(name) === fn) windowListeners.delete(name); }
};
class FakeObserver { observe() {} disconnect() { this.disconnected = true; } }

const controller = api.createController({ documentRef, storage, guard, windowRef, MutationObserverImpl: FakeObserver });
assert.equal(controller.mount(), true);
assert.equal(childRow.dataset.conversationId, 'child-1');
assert.equal(parentRow.dataset.conversationId, 'parent-1');
assert.equal(controller.currentEntry(), null);

assert.equal(controller.record({
  childConversationId: 'child-1',
  parentConversationId: 'parent-1',
  sourceMessageId: 'message-1',
  mode: 'fork',
  createdAt: '2026-08-19T00:00:00.000Z'
}), true);
assert.equal(controller.currentEntry()?.parentConversationId, 'parent-1');
assert.equal(controller.openSource(), true);
assert.equal(parentClicks, 1);

const persisted = JSON.parse(values.get(api.STORAGE_KEY));
assert.equal(persisted.length, 1);
assert.deepEqual(Object.keys(persisted[0]).sort(), ['childConversationId', 'createdAt', 'mode', 'parentConversationId', 'sourceMessageId'].sort());

assert.equal(controller.record({ ...persisted[0], childConversationId: 'missing-child' }), false);
assert.equal(JSON.parse(values.get(api.STORAGE_KEY)).length, 1);

conversationRaw = JSON.stringify([conversations[0]]);
values.set(api.CONVERSATION_KEY, conversationRaw);
assert.equal(controller.currentEntry(), null, 'deleted parent must invalidate lineage');
assert.equal(controller.openSource(), false);

controller.destroy();
assert.equal(stage.children[0]?.removed, true);

console.log('conversation branch lineage controller: ok');
