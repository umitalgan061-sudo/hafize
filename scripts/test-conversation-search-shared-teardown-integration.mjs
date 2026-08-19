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

const input = emitter({ value: 'needle', focus() {} });
const clear = emitter({ disabled: false });
const status = { textContent: '' };
const list = {
  querySelectorAll(selector) {
    if (selector === '.conversation-row') return [];
    if (selector === `.${snippets.SNIPPET_CLASS}`) return [];
    return [];
  }
};
const control = {
  querySelector(selector) {
    if (selector === `#${search.INPUT_ID}`) return input;
    if (selector === '.conversation-search-clear') return clear;
    if (selector === `#${search.STATUS_ID}`) return status;
    return null;
  },
  remove() {}
};
const history = { insertBefore() {} };
const documentRef = {
  head: { append() {} },
  getElementById: () => ({}),
  querySelector(selector) {
    if (selector === '.history-block') return history;
    if (selector === '#conversationList') return list;
    if (selector === '#conversationSearchControl') return control;
    if (selector === '#conversationSearchInput') return input;
    if (selector === `#${search.STYLE_ID}`) return {};
    return null;
  },
  createElement() { throw new Error('unexpected element creation'); }
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
const snippetController = snippets.createController({ documentRef, rootRef: root, MutationObserverImpl: Observer });
assert.equal(searchController.mount(), true);
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

for (const callback of queued.splice(0)) callback();
assert.equal(storageReads, initialReads, 'destroyed shared search controllers must not re-read storage from queued work');
assert.equal(searchController.apply().ok, false);
assert.equal(snippetController.apply().rows, 0);

console.log('conversation search shared teardown integration tests passed');
