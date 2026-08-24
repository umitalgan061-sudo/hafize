import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');
const snippets = require('../public/conversation-search-snippets.js');

function emitter(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, fn) {
      const bucket = listeners.get(type) || new Set();
      bucket.add(fn);
      listeners.set(type, bucket);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type, event = {}) { for (const fn of listeners.get(type) || []) fn(event); },
    count(type) { return listeners.get(type)?.size || 0; }
  };
}

class FakeNode {
  constructor(tag = 'div') {
    Object.assign(this, emitter());
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  insertBefore(node, reference) {
    node.parentNode = this;
    const index = this.children.indexOf(reference);
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  setAttribute() {}
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    return false;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }
}

const head = new FakeNode('head');
const history = new FakeNode('section');
history.className = 'history-block';
const list = new FakeNode();
list.id = 'conversationList';
history.append(list);
const roots = [head, history];
const documentRef = {
  head,
  createElement: (tag) => new FakeNode(tag),
  querySelector(selector) {
    for (const root of roots) {
      if (root.matches(selector)) return root;
      const found = root.querySelector(selector);
      if (found) return found;
    }
    return null;
  },
  getElementById(id) { return this.querySelector(`#${id}`); }
};

let storageReads = 0;
const queued = [];
const root = emitter({
  localStorage: { getItem() { storageReads += 1; return '[]'; } },
  HafizeConversationStorageGuard: {
    STORAGE_KEY: 'hafize.conversations.v1',
    sanitizeStoredValue: () => ({ value: [] })
  },
  requestAnimationFrame(callback) { queued.push(callback); return queued.length; }
});

class Observer {
  constructor(callback) { this.callback = callback; }
  observe() {}
  disconnect() { this.disconnected = true; }
}

const searchController = search.createController({ documentRef, rootRef: root, MutationObserverImpl: Observer });
assert.equal(searchController.mount(), true);
const input = documentRef.querySelector(`#${search.INPUT_ID}`);
assert.ok(input, 'search controller must create and own the shared input');

const snippetController = snippets.createController({ documentRef, rootRef: root, MutationObserverImpl: Observer });
assert.equal(snippetController.mount(), true);
assert.equal(root.count('storage'), 2);
assert.equal(root.count('hafize:conversation-storage-merged'), 2);

const initialReads = storageReads;
root.emit('storage', { key: 'hafize.conversations.v1' });
input.emit('input');
assert.equal(queued.length >= 2, true);

searchController.destroy();
snippetController.destroy();
assert.equal(root.count('storage'), 0);
assert.equal(root.count('hafize:conversation-storage-merged'), 0);
assert.equal(documentRef.querySelector(`#${search.CONTROL_ID}`), null, 'owned search control must be removed');

for (const callback of queued.splice(0)) callback();
assert.equal(storageReads, initialReads, 'destroyed shared search controllers must not re-read storage from queued work');
assert.equal(searchController.apply().ok, false);
assert.equal(snippetController.apply().rows, 0);

console.log('conversation search shared teardown integration tests passed');
