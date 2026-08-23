import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

function element(tag = 'div') {
  const listeners = new Map();
  return {
    tag,
    id: '',
    className: '',
    hidden: false,
    type: '',
    textContent: '',
    dataset: {},
    children: [],
    attributes: new Map(),
    classList: { contains: () => false },
    append(...nodes) { this.children.push(...nodes); },
    prepend(...nodes) { this.children.unshift(...nodes); },
    remove() { this.removed = true; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { listeners.delete(name); },
    click() { listeners.get('click')?.({ preventDefault() {} }); },
    querySelector() { return null; }
  };
}

const opened = [];
function row(id, active = false) {
  const open = { click: () => opened.push(id) };
  return {
    dataset: { conversationId: id, conversationOrganizeId: id },
    classList: { contains: (name) => name === 'active' && active },
    querySelector: (selector) => selector === '.conversation-open' ? open : null
  };
}

const rows = [row('branch-a'), row('branch-b', true), row('branch-c'), row('root')];
const stage = element('main');
const listNode = element('div');
const head = element('head');
const documentListeners = new Map();
const documentRef = {
  head,
  createElement: (tag) => element(tag),
  getElementById: () => null,
  querySelector(selector) {
    if (selector === '.chat-stage') return stage;
    if (selector === '#conversationList') return listNode;
    return null;
  },
  querySelectorAll(selector) {
    return selector === '#conversationList .conversation-row' ? rows : [];
  },
  addEventListener(name, handler) { documentListeners.set(name, handler); },
  removeEventListener(name) { documentListeners.delete(name); }
};

const conversations = rows.map((item) => ({ id: item.dataset.conversationId, messages: item.dataset.conversationId === 'root' ? [{ id: 'm1' }] : [] }));
const lineage = [
  { childConversationId: 'branch-c', parentConversationId: 'root', sourceMessageId: 'm1', mode: 'edit', createdAt: '2026-08-19T02:00:00.000Z' },
  { childConversationId: 'branch-b', parentConversationId: 'root', sourceMessageId: 'm1', mode: 'fork', createdAt: '2026-08-19T01:00:00.000Z' },
  { childConversationId: 'branch-a', parentConversationId: 'root', sourceMessageId: 'm1', mode: 'fork', createdAt: '2026-08-19T00:00:00.000Z' }
];
const values = new Map([
  [api.CONVERSATION_KEY, JSON.stringify(conversations)],
  [api.STORAGE_KEY, JSON.stringify(lineage)]
]);
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value))
};
const guard = {
  sanitizeStoredValue(raw) {
    return { value: JSON.parse(raw) };
  }
};
const windowListeners = new Map();
const windowRef = {
  addEventListener(name, handler) { windowListeners.set(name, handler); },
  removeEventListener(name) { windowListeners.delete(name); }
};
class Observer {
  observe() { this.observing = true; }
  disconnect() { this.observing = false; }
}

const controller = api.createController({ documentRef, storage, guard, windowRef, MutationObserverImpl: Observer });
assert.equal(controller.mount(), true);
const context = controller.currentContext();
assert.equal(context.entry.childConversationId, 'branch-b');
assert.equal(context.siblings.entries.length, 3);
assert.equal(context.siblings.index, 1);
assert.equal(context.siblings.previousConversationId, 'branch-a');
assert.equal(context.siblings.nextConversationId, 'branch-c');

assert.equal(controller.openPreviousSibling(), true);
assert.equal(controller.openNextSibling(), true);
assert.deepEqual(opened, ['branch-a', 'branch-c']);
assert.equal(controller.openSource(), true);
assert.deepEqual(opened, ['branch-a', 'branch-c', 'root']);

const banner = stage.children[0];
assert.equal(banner.hidden, false);
const label = banner.children[0];
assert.match(label.textContent, /alternatif 2\/3/);
const actions = banner.children[1];
assert.equal(actions.children[0].hidden, false);
assert.equal(actions.children[1].hidden, false);
assert.equal(actions.children[0].textContent, '← Önceki alternatif');
assert.equal(actions.children[1].textContent, 'Sonraki alternatif →');

controller.destroy();
assert.equal(banner.removed, true);
assert.equal(documentListeners.has(api.BRANCH_EVENT), false);
assert.equal(windowListeners.has('storage'), false);

console.log('conversation branch alternative controller tests passed');
