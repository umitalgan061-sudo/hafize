import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');

function eventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    fire(type, event = {}) { listeners.get(type)?.(event); },
    listenerCount() { return listeners.size; }
  };
}

function makeFixture({ preexisting = false } = {}) {
  const input = eventTarget({ value: '', focusCount: 0, focus() { this.focusCount += 1; } });
  const clear = eventTarget({ disabled: true });
  const status = { textContent: '' };
  const list = { querySelectorAll: () => [] };
  const control = {
    removed: false,
    querySelector(selector) {
      if (selector === `#${search.INPUT_ID}`) return input;
      if (selector === '.conversation-search-clear') return clear;
      if (selector === `#${search.STATUS_ID}`) return status;
      return null;
    },
    remove() { this.removed = true; }
  };
  const history = { insertBefore() {} };
  const root = eventTarget({
    requestAnimationFrame(callback) { this.pending = callback; return 1; },
    localStorage: { getItem: () => '[]' },
    HafizeConversationStorageGuard: {
      STORAGE_KEY: 'hafize.conversations.v1',
      sanitizeStoredValue: () => ({ value: [] })
    }
  });
  const documentRef = {
    head: { append() {} },
    querySelector(selector) {
      if (selector === '.history-block') return history;
      if (selector === '#conversationList') return list;
      if (selector === `#${search.CONTROL_ID}`) return preexisting ? control : null;
      if (selector === `#${search.STYLE_ID}`) return {};
      return null;
    },
    createElement(tag) {
      if (tag === 'div') return control;
      throw new Error(`unexpected createElement ${tag}`);
    }
  };
  return { input, clear, status, list, control, history, root, documentRef };
}

class Observer {
  constructor(callback) { this.callback = callback; }
  observe() { this.observing = true; }
  disconnect() { this.disconnected = true; }
}

{
  const f = makeFixture({ preexisting: true });
  const controller = search.createController({ documentRef: f.documentRef, rootRef: f.root, MutationObserverImpl: Observer });
  assert.equal(controller.mount(), true);
  assert.equal(f.input.listenerCount(), 2);
  assert.equal(f.clear.listenerCount(), 1);
  assert.equal(f.root.listenerCount(), 2);

  f.input.value = 'aranan';
  f.input.fire('input');
  f.input.fire('keydown', {
    key: 'Escape',
    defaultPrevented: false,
    preventDefault() { this.prevented = true; }
  });
  assert.equal(f.input.value, '');
  assert.equal(f.input.focusCount, 1);

  controller.destroy();
  assert.equal(f.input.listenerCount(), 0);
  assert.equal(f.clear.listenerCount(), 0);
  assert.equal(f.root.listenerCount(), 0);
  assert.equal(f.control.removed, false, 'preexisting control must not be removed');
  assert.equal(controller.apply().ok, false, 'destroyed controller must be inert');
}

{
  const f = makeFixture({ preexisting: true });
  const controller = search.createController({ documentRef: f.documentRef, rootRef: f.root, MutationObserverImpl: Observer });
  assert.equal(controller.mount(), true);
  f.root.fire('hafize:conversation-storage-merged');
  assert.equal(typeof f.root.pending, 'function');
  controller.destroy();
  assert.doesNotThrow(() => f.root.pending());
  assert.equal(f.input.listenerCount(), 0);
}

{
  const f = makeFixture({ preexisting: true });
  const controller = search.createController({ documentRef: f.documentRef, rootRef: f.root, MutationObserverImpl: Observer });
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), false, 'double mount must fail closed');
  controller.destroy();
  assert.equal(controller.mount(), true, 'same controller may mount cleanly after destroy');
  controller.destroy();
}

console.log('conversation search lifecycle cleanup tests passed');
