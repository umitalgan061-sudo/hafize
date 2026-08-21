import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-search-snippets.js');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
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
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  addEventListener(type, listener) {
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
    const found = [];
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
}

function fixture() {
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  const input = new FakeElement('input');
  const list = new FakeElement('div');
  const row = new FakeElement('button');
  input.id = api.INPUT_ID;
  list.id = api.LIST_ID;
  row.className = 'conversation-row';
  row.dataset.conversationId = 'c1';
  list.append(row);
  body.append(input, list);

  const documentRef = {
    head,
    body,
    createElement: (tag) => new FakeElement(tag),
    querySelector: (selector) => body.querySelector(selector),
    getElementById(id) { return head.querySelector(`#${id}`) || body.querySelector(`#${id}`); }
  };

  const rootListeners = new Map();
  const rafs = new Map();
  let rafId = 0;
  let reads = 0;
  const rootRef = {
    HafizeConversationStorageGuard: {
      STORAGE_KEY: api.STORAGE_KEY,
      sanitizeStoredValue(raw) { return { value: JSON.parse(raw) }; }
    },
    localStorage: {
      getItem() {
        reads += 1;
        return JSON.stringify([{ id: 'c1', messages: [{ role: 'assistant', content: 'hedef metin' }] }]);
      }
    },
    addEventListener(type, listener) {
      if (!rootListeners.has(type)) rootListeners.set(type, []);
      rootListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      rootListeners.set(type, (rootListeners.get(type) || []).filter((entry) => entry !== listener));
    },
    requestAnimationFrame(callback) {
      const id = ++rafId;
      rafs.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { rafs.delete(id); }
  };

  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }

  return {
    head,
    input,
    list,
    row,
    documentRef,
    rootRef,
    rootListeners,
    rafs,
    get reads() { return reads; },
    FakeMutationObserver
  };
}

function fire(target, type, event = {}) {
  for (const listener of [...(target.listeners.get(type) || [])]) listener(event);
}

{
  const f = fixture();
  f.input.value = 'hedef';
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, MutationObserverImpl: f.FakeMutationObserver });
  assert.equal(controller.mount(), true);
  assert.equal(f.reads, 1);
  assert.match(f.row.querySelector(`.${api.SNIPPET_CLASS}`).textContent, /Hafize/);

  const second = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, MutationObserverImpl: f.FakeMutationObserver });
  assert.equal(second.mount(), false, 'duplicate list ownership fails closed');

  fire(f.input, 'input');
  assert.equal(f.rafs.size, 1);
  const staleCallback = [...f.rafs.values()][0];
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(f.rafs.size, 0, 'queued RAF cancelled');
  staleCallback();
  assert.equal(f.reads, 1, 'stale callback cannot read storage');
  assert.equal(f.row.querySelector(`.${api.SNIPPET_CLASS}`), null, 'owned snippet removed');

  assert.equal(second.mount(), true, 'new controller can cleanly remount after owner teardown');
  second.destroy();
}

{
  const f = fixture();
  const hostSnippet = new FakeElement('small');
  hostSnippet.className = api.SNIPPET_CLASS;
  hostSnippet.textContent = 'host text';
  hostSnippet.hidden = true;
  f.row.append(hostSnippet);
  const hostStyle = new FakeElement('style');
  hostStyle.id = api.STYLE_ID;
  hostStyle.textContent = 'host style';
  f.head.append(hostStyle);
  f.input.value = 'hedef';

  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, MutationObserverImpl: f.FakeMutationObserver });
  assert.equal(controller.mount(), true);
  assert.notEqual(hostSnippet.textContent, 'host text');
  assert.equal(hostSnippet.hidden, false);
  controller.destroy();
  assert.equal(hostSnippet.textContent, 'host text');
  assert.equal(hostSnippet.hidden, true);
  assert.equal(f.documentRef.getElementById(api.STYLE_ID), hostStyle, 'host style preserved');
}

{
  const f = fixture();
  f.input.value = 'hedef';
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, MutationObserverImpl: f.FakeMutationObserver });
  controller.mount();
  fire(f.input, 'input');
  fire(f.input, 'input');
  assert.equal(f.rafs.size, 1, 'refresh requests coalesce');
  const [id, callback] = [...f.rafs.entries()][0];
  f.rafs.delete(id);
  callback();
  assert.equal(controller.getState().queued, false);
  assert.equal(f.reads, 2);
  controller.destroy();
}

console.log('conversation search snippet lifecycle tests passed');
