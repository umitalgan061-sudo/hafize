import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-search-snippets.js');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.textContent = '';
    this.value = '';
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((node) => node !== this); this.parentNode = null; } }
  addEventListener(type, listener) {
    if (this.failListener) throw new Error('listener install failed');
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== listener));
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    return false;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    let found = [];
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child);
      found = found.concat(child.querySelectorAll(selector));
    }
    return found;
  }
}

function makeFixture({ failInput = false, observerMode = 'ok' } = {}) {
  const head = new Element('head');
  const body = new Element('body');
  const input = new Element('input');
  const list = new Element('div');
  const row = new Element('button');
  input.id = api.INPUT_ID;
  input.failListener = failInput;
  list.id = api.LIST_ID;
  row.className = 'conversation-row';
  row.dataset.conversationId = 'c1';
  list.append(row);
  body.append(input, list);

  const documentRef = {
    head,
    body,
    createElement: (tag) => new Element(tag),
    querySelector: (selector) => body.querySelector(selector),
    getElementById(id) { return head.querySelector(`#${id}`) || body.querySelector(`#${id}`); }
  };
  const listeners = new Map();
  const rootRef = {
    HafizeConversationStorageGuard: {
      STORAGE_KEY: api.STORAGE_KEY,
      sanitizeStoredValue(raw) { return { value: JSON.parse(raw) }; }
    },
    localStorage: { getItem: () => JSON.stringify([{ id: 'c1', messages: [{ role: 'user', content: 'hedef' }] }]) },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== listener));
    },
    setTimeout(callback) { this.timer = callback; return 9; },
    clearTimeout(id) { this.cleared = id; }
  };
  class MutationObserverImpl {
    constructor(callback) {
      if (observerMode === 'constructor') throw new Error('observer constructor failed');
      this.callback = callback;
    }
    observe() { if (observerMode === 'observe') throw new Error('observer observe failed'); }
    disconnect() { this.disconnected = true; }
  }
  return { head, input, list, documentRef, rootRef, listeners, MutationObserverImpl };
}

for (const observerMode of ['constructor', 'observe']) {
  const fixture = makeFixture({ observerMode });
  const controller = api.createController({ documentRef: fixture.documentRef, rootRef: fixture.rootRef, MutationObserverImpl: fixture.MutationObserverImpl });
  assert.equal(controller.mount(), false);
  assert.equal(fixture.head.querySelector(`#${api.STYLE_ID}`), null, 'owned style rolled back');
  assert.equal((fixture.input.listeners.get('input') || []).length, 0);
  assert.equal((fixture.listeners.get('storage') || []).length, 0);

  const retry = api.createController({ documentRef: fixture.documentRef, rootRef: fixture.rootRef, MutationObserverImpl: null });
  assert.equal(retry.mount(), true, 'ownership released after failed install');
  retry.destroy();
}

{
  const fixture = makeFixture({ failInput: true });
  const controller = api.createController({ documentRef: fixture.documentRef, rootRef: fixture.rootRef, MutationObserverImpl: null });
  assert.equal(controller.mount(), false);
  assert.equal(fixture.head.querySelector(`#${api.STYLE_ID}`), null);
  fixture.input.failListener = false;
  const retry = api.createController({ documentRef: fixture.documentRef, rootRef: fixture.rootRef, MutationObserverImpl: null });
  assert.equal(retry.mount(), true);
  retry.destroy();
}

{
  const fixture = makeFixture();
  const controller = api.createController({ documentRef: fixture.documentRef, rootRef: fixture.rootRef, MutationObserverImpl: null });
  assert.equal(controller.mount(), true);
  assert.equal(controller.queueApply(), true);
  assert.equal(controller.queueApply(), false, 'timer fallback coalesces');
  assert.equal(controller.getState().queued, true);
  controller.destroy();
  assert.equal(fixture.rootRef.cleared, 9, 'timer fallback cancelled on destroy');
  fixture.rootRef.timer?.();
  assert.equal(controller.getState().destroyed, true);
}

{
  const fixture = makeFixture();
  delete fixture.rootRef.setTimeout;
  const controller = api.createController({ documentRef: fixture.documentRef, rootRef: fixture.rootRef, MutationObserverImpl: null });
  assert.equal(controller.mount(), true);
  assert.equal(controller.queueApply(), false, 'missing scheduler fails closed');
  controller.destroy();
}

console.log('conversation search snippet installation tests passed');
