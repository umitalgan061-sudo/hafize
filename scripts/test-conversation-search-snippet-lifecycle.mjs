import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const snippets = require('../public/conversation-search-snippets.js');

function target(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    fire(type, event = {}) { listeners.get(type)?.(event); },
    listenerCount() { return listeners.size; }
  };
}

const input = target({ value: 'needle' });
const snippetNode = { removed: false, remove() { this.removed = true; } };
const row = {
  hidden: false,
  dataset: { conversationId: 'c1' },
  querySelector(selector) { return selector === `.${snippets.SNIPPET_CLASS}` ? snippetNode : null; },
  append() {}
};
const list = {
  querySelectorAll(selector) {
    if (selector === '.conversation-row') return [row];
    if (selector === `.${snippets.SNIPPET_CLASS}`) return [snippetNode];
    return [];
  }
};
let storageReads = 0;
const root = target({
  pending: null,
  requestAnimationFrame(callback) { this.pending = callback; return 1; },
  localStorage: { getItem() { storageReads += 1; return '[]'; } },
  HafizeConversationStorageGuard: {
    STORAGE_KEY: snippets.STORAGE_KEY,
    sanitizeStoredValue: () => ({ value: [] })
  }
});
const documentRef = {
  head: { append() {} },
  getElementById: () => ({}),
  querySelector(selector) {
    if (selector === `#${snippets.INPUT_ID}`) return input;
    if (selector === `#${snippets.LIST_ID}`) return list;
    return null;
  },
  createElement() { throw new Error('unexpected element creation'); }
};
class Observer {
  constructor(callback) { this.callback = callback; }
  observe() { this.observing = true; }
  disconnect() { this.disconnected = true; }
}

const controller = snippets.createController({ documentRef, rootRef: root, MutationObserverImpl: Observer });
assert.equal(controller.mount(), true);
assert.equal(controller.mount(), false, 'double mount must fail closed');
assert.equal(input.listenerCount(), 1);
assert.equal(root.listenerCount(), 2);
assert.equal(storageReads, 1);

input.fire('input');
assert.equal(typeof root.pending, 'function');
const readsBeforeDestroy = storageReads;
controller.destroy();
assert.equal(input.listenerCount(), 0);
assert.equal(root.listenerCount(), 0);
assert.equal(snippetNode.removed, true);
assert.equal(controller.apply().rows, 0);

root.pending();
assert.equal(storageReads, readsBeforeDestroy, 'queued callback must not read storage after destroy');

assert.equal(controller.mount(), true, 'clean remount should be supported');
assert.equal(input.listenerCount(), 1);
controller.destroy();
assert.equal(input.listenerCount(), 0);

console.log('conversation search snippet lifecycle tests passed');
