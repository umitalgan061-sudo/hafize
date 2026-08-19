import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');
const guard = require('../public/conversation-storage-guard.js');

class FakeNode {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.textContent = '';
    this.id = '';
    this.className = '';
    this.parent = null;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }
  insertBefore(node, reference) {
    node.parent = this;
    const index = this.children.indexOf(reference);
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
  }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback);
    this.listeners.set(type, list);
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== callback));
  }
  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) callback({ target: this, ...event });
  }
  focus() { this.focused = true; }
  matchesSelector(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    return false;
  }
  querySelector(selector) {
    if (this.matchesSelector(selector)) return this;
    for (const child of this.children) {
      const match = child.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
  querySelectorAll(selector) {
    const matches = [];
    if (this.matchesSelector(selector)) matches.push(this);
    for (const child of this.children) matches.push(...child.querySelectorAll(selector));
    return matches;
  }
}

function conversationRow(id, title) {
  const row = new FakeNode();
  row.className = 'conversation-row';
  row.dataset.conversationId = id;
  const open = new FakeNode('button');
  open.className = 'conversation-open';
  open.textContent = title;
  row.append(open);
  return row;
}

const head = new FakeNode('head');
const history = new FakeNode('section');
history.className = 'history-block';
const list = new FakeNode();
list.id = 'conversationList';
const row1 = conversationRow('conv-1', 'Birinci sohbet');
const row2 = conversationRow('conv-2', 'İkinci sohbet');
list.append(row1, row2);
history.append(list);
const roots = [head, history];

const documentRef = {
  head,
  createElement: (tag) => new FakeNode(tag),
  querySelector(selector) {
    for (const root of roots) {
      const match = root.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
};

let stored = JSON.stringify([
  { id: 'conv-1', title: 'Birinci sohbet', messages: [{ id: 'm1', role: 'user', content: 'ilk needle', createdAt: '2026-08-19T03:00:00.000Z' }] },
  { id: 'conv-2', title: 'İkinci sohbet', messages: [{ id: 'm2', role: 'assistant', content: 'başka içerik', createdAt: '2026-08-19T03:00:01.000Z' }] }
]);
const rootListeners = new Map();
const rootRef = {
  HafizeConversationStorageGuard: guard,
  localStorage: { getItem: () => stored },
  requestAnimationFrame(callback) { callback(); return 1; },
  addEventListener(type, callback) {
    const list = rootListeners.get(type) || [];
    list.push(callback);
    rootListeners.set(type, list);
  },
  removeEventListener(type, callback) {
    rootListeners.set(type, (rootListeners.get(type) || []).filter((entry) => entry !== callback));
  },
  dispatch(type, event) {
    for (const callback of rootListeners.get(type) || []) callback(event);
  }
};

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; this.disconnected = false; }
  observe(target, options) { this.target = target; this.options = options; }
  disconnect() { this.disconnected = true; }
}

const controller = search.createController({ documentRef, rootRef, MutationObserverImpl: FakeMutationObserver });
assert.equal(controller.mount(), true);
const input = documentRef.querySelector('#conversationSearchInput');
assert.ok(input);
input.value = 'needle';
input.dispatch('input');
assert.equal(row1.hidden, false);
assert.equal(row2.hidden, true);

stored = JSON.stringify([
  { id: 'conv-1', title: 'Birinci sohbet', messages: [{ id: 'm1', role: 'user', content: 'artık yok', createdAt: '2026-08-19T03:00:00.000Z' }] },
  { id: 'conv-2', title: 'İkinci sohbet', messages: [{ id: 'm2', role: 'assistant', content: 'needle yeni sekmeden geldi', createdAt: '2026-08-19T03:00:01.000Z' }] }
]);
rootRef.dispatch('storage', { key: guard.STORAGE_KEY });
assert.equal(row1.hidden, true);
assert.equal(row2.hidden, false);

stored = 'not-json';
rootRef.dispatch('hafize:conversation-storage-merged', {});
assert.equal(row1.hidden, true, 'invalid storage must not expose arbitrary raw content');
assert.equal(row2.hidden, true, 'invalid storage must fail closed to title-only matching');

controller.clear({ focus: false });
assert.equal(row1.hidden, false);
assert.equal(row2.hidden, false);
controller.destroy();
assert.equal(documentRef.querySelector('#conversationSearchControl'), null);
assert.equal((rootListeners.get('storage') || []).length, 0);
assert.equal((rootListeners.get('hafize:conversation-storage-merged') || []).length, 0);

console.log('conversation search controller sync tests passed');