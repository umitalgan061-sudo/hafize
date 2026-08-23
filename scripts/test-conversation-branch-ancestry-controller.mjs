import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, console, globalThis: {} };
vm.runInNewContext(source, sandbox, { filename: 'conversation-branch-lineage.js' });
const api = sandbox.module.exports;

function makeClassList(active = false) {
  return { contains(name) { return name === 'active' && active; } };
}

function makeRow(id, { active = false, onOpen = () => {} } = {}) {
  const open = { click: onOpen };
  return {
    dataset: { conversationOrganizeId: id, conversationId: id },
    classList: makeClassList(active),
    querySelector(selector) { return selector === '.conversation-open' ? open : null; }
  };
}

const opened = [];
const rows = [
  makeRow('leaf', { active: true }),
  makeRow('middle', { onOpen: () => opened.push('middle') }),
  makeRow('root', { onOpen: () => opened.push('root') })
];

function element(tag) {
  return {
    tag,
    className: '',
    hidden: false,
    textContent: '',
    type: '',
    children: [],
    listeners: new Map(),
    setAttribute() {},
    append(...nodes) { this.children.push(...nodes); },
    prepend(...nodes) { this.children.unshift(...nodes); },
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    remove() { this.removed = true; }
  };
}

const stage = element('stage');
const listNode = element('list');
const documentRef = {
  head: element('head'),
  getElementById() { return null; },
  createElement: element,
  querySelector(selector) {
    if (selector === '.chat-stage') return stage;
    if (selector === '#conversationList') return listNode;
    return null;
  },
  querySelectorAll(selector) { return selector === '#conversationList .conversation-row' ? rows : []; },
  addEventListener() {},
  removeEventListener() {}
};

const conversations = [
  { id: 'leaf', messages: [] },
  { id: 'middle', messages: [{ id: 'm-leaf' }] },
  { id: 'root', messages: [{ id: 'm-middle' }] }
];
const branchEntries = [
  {
    childConversationId: 'leaf',
    parentConversationId: 'middle',
    sourceMessageId: 'm-leaf',
    mode: 'fork',
    createdAt: '2026-08-19T00:00:00.000Z'
  },
  {
    childConversationId: 'middle',
    parentConversationId: 'root',
    sourceMessageId: 'm-middle',
    mode: 'edit',
    createdAt: '2026-08-18T23:00:00.000Z'
  }
];
const values = new Map([
  [api.CONVERSATION_KEY, JSON.stringify(conversations)],
  [api.STORAGE_KEY, JSON.stringify(branchEntries)]
]);
const storage = {
  getItem(key) { return values.get(key) || null; },
  setItem(key, value) { values.set(key, value); }
};
const guard = { sanitizeStoredValue(raw) { return { value: JSON.parse(raw) }; } };
let observed = null;
class Observer {
  constructor(callback) { this.callback = callback; }
  observe(target, options) { observed = { target, options }; }
  disconnect() {}
}
const windowRef = { addEventListener() {}, removeEventListener() {} };

const controller = api.createController({ documentRef, storage, guard, MutationObserverImpl: Observer, windowRef });
assert.equal(controller.mount(), true);
assert.deepEqual(Array.from(observed.options.attributeFilter), ['class', 'data-conversation-organize-id']);

const context = controller.currentContext();
assert.equal(context.entry.childConversationId, 'leaf');
assert.equal(context.ancestry.depth, 2);
assert.equal(context.ancestry.rootConversationId, 'root');

const banner = stage.children[0];
assert.equal(banner.hidden, false);
const label = banner.children[0];
const actions = banner.children[1];
const sourceButton = actions.children[2];
const rootButton = actions.children[3];
assert.match(label.textContent, /2\. seviye dal/);
assert.equal(rootButton.hidden, false);

assert.equal(controller.openSource(), true);
assert.deepEqual(opened, ['middle']);
assert.equal(controller.openRoot(), true);
assert.deepEqual(opened, ['middle', 'root']);

rows[0].classList = makeClassList(false);
rows[1].classList = makeClassList(true);
controller.render();
assert.match(label.textContent, /Düzenleme \/ tekrar dalı/);
assert.doesNotMatch(label.textContent, /2\. seviye/);
assert.equal(rootButton.hidden, true);
assert.equal(controller.openRoot(), false);

const cyclicAttempt = {
  childConversationId: 'root',
  parentConversationId: 'leaf',
  sourceMessageId: 'm-cycle',
  mode: 'fork',
  createdAt: '2026-08-19T01:00:00.000Z'
};
assert.equal(controller.record(cyclicAttempt), false);
const persisted = JSON.parse(values.get(api.STORAGE_KEY));
assert.equal(persisted.some((item) => item.childConversationId === 'root'), false);

controller.destroy();
assert.equal(banner.removed, true);

console.log('conversation branch ancestry controller tests passed');
