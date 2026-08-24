import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');

class El {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.focusCount = 0;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  insertBefore(node, before) {
    node.parentNode = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback);
    this.listeners.set(type, list);
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== callback));
  }
  fire(type, event = {}) {
    for (const callback of this.listeners.get(type) || []) callback(event);
  }
  listenerCount() {
    let count = 0;
    for (const listeners of this.listeners.values()) count += listeners.length;
    return count;
  }
  focus() { this.focusCount += 1; }
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

function makeFixture() {
  const head = new El('head');
  const body = new El('body');
  const history = new El('section');
  history.className = 'history-block';
  const list = new El();
  list.id = 'conversationList';
  history.append(list);
  body.append(history);

  const documentRef = {
    head,
    body,
    createElement: (tag) => new El(tag),
    querySelector(selector) {
      if (selector === '.history-block') return history;
      if (selector === '#conversationList') return list;
      return body.querySelector(selector) || head.querySelector(selector);
    }
  };

  const rootListeners = new Map();
  const animationFrames = new Map();
  let nextAnimationFrameId = 1;
  const root = {
    localStorage: { getItem: () => '[]' },
    HafizeConversationStorageGuard: {
      STORAGE_KEY: 'hafize.conversations.v1',
      sanitizeStoredValue: () => ({ value: [] })
    },
    addEventListener(type, callback) {
      const listeners = rootListeners.get(type) || [];
      listeners.push(callback);
      rootListeners.set(type, listeners);
    },
    removeEventListener(type, callback) {
      rootListeners.set(type, (rootListeners.get(type) || []).filter((entry) => entry !== callback));
    },
    fire(type, event = {}) {
      for (const callback of rootListeners.get(type) || []) callback(event);
    },
    listenerCount() {
      let count = 0;
      for (const listeners of rootListeners.values()) count += listeners.length;
      return count;
    },
    requestAnimationFrame(callback) {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { animationFrames.delete(id); }
  };

  class Observer {
    constructor(callback) { this.callback = callback; }
    observe() { this.observing = true; }
    disconnect() { this.disconnected = true; }
  }

  return { documentRef, root, animationFrames, Observer };
}

{
  const f = makeFixture();
  const controller = search.createController({ documentRef: f.documentRef, rootRef: f.root, MutationObserverImpl: f.Observer });
  assert.equal(controller.mount(), true);
  const input = f.documentRef.querySelector(`#${search.INPUT_ID}`);
  const clear = f.documentRef.querySelector('.conversation-search-clear');
  assert.ok(input);
  assert.ok(clear);
  assert.equal(input.listenerCount(), 2);
  assert.equal(clear.listenerCount(), 1);
  assert.equal(f.root.listenerCount(), 2);

  input.value = 'aranan';
  input.fire('input');
  input.fire('keydown', {
    key: 'Escape',
    defaultPrevented: false,
    preventDefault() { this.prevented = true; }
  });
  assert.equal(input.value, '');
  assert.equal(input.focusCount, 1);

  assert.equal(controller.destroy(), true);
  assert.equal(input.listenerCount(), 0);
  assert.equal(clear.listenerCount(), 0);
  assert.equal(f.root.listenerCount(), 0);
  assert.equal(f.documentRef.querySelector(`#${search.CONTROL_ID}`), null, 'owned control must be removed');
  assert.equal(controller.apply().ok, false, 'destroyed controller must be inert');
}

{
  const f = makeFixture();
  const controller = search.createController({ documentRef: f.documentRef, rootRef: f.root, MutationObserverImpl: f.Observer });
  assert.equal(controller.mount(), true);
  f.root.fire('hafize:conversation-storage-merged');
  assert.equal(f.animationFrames.size, 1);
  const staleRefresh = [...f.animationFrames.values()][0];
  controller.destroy();
  assert.equal(f.animationFrames.size, 0, 'destroy must cancel queued refresh');
  assert.doesNotThrow(() => staleRefresh());
  assert.equal(f.root.listenerCount(), 0);
}

{
  const f = makeFixture();
  const controller = search.createController({ documentRef: f.documentRef, rootRef: f.root, MutationObserverImpl: f.Observer });
  assert.equal(controller.mount(), true);
  assert.equal(controller.mount(), false, 'double mount must fail closed');
  controller.destroy();
  assert.equal(controller.mount(), false, 'destroy is terminal for the same controller');

  const replacement = search.createController({ documentRef: f.documentRef, rootRef: f.root, MutationObserverImpl: f.Observer });
  assert.equal(replacement.mount(), true, 'a new controller may mount after ownership is released');
  replacement.destroy();
}

console.log('conversation search lifecycle cleanup tests passed');
