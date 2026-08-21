import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-search-snippets.js');

class Node {
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

function build() {
  const head = new Node('head');
  const body = new Node('body');
  const input = new Node('input');
  const list = new Node('div');
  input.id = api.INPUT_ID;
  input.value = 'needle';
  list.id = api.LIST_ID;
  body.append(input, list);

  const documentRef = {
    head,
    body,
    createElement: (tag) => new Node(tag),
    querySelector: (selector) => body.querySelector(selector),
    getElementById(id) { return head.querySelector(`#${id}`) || body.querySelector(`#${id}`); }
  };

  let storageReads = 0;
  const rootListeners = new Map();
  const rafs = new Map();
  let nextRaf = 0;
  const rootRef = {
    HafizeConversationStorageGuard: {
      STORAGE_KEY: api.STORAGE_KEY,
      sanitizeStoredValue(raw) { return { value: JSON.parse(raw) }; }
    },
    localStorage: {
      getItem() {
        storageReads += 1;
        return JSON.stringify([
          { id: 'visible', messages: [{ role: 'user', content: 'needle visible' }] },
          { id: 'hidden', messages: [{ role: 'assistant', content: 'needle hidden' }] },
          { id: 'late', messages: [{ role: 'assistant', content: 'needle late' }] }
        ]);
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
      const id = ++nextRaf;
      rafs.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { rafs.delete(id); }
  };

  let observer = null;
  class MutationObserverImpl {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }

  return {
    head,
    input,
    list,
    documentRef,
    rootRef,
    rootListeners,
    rafs,
    get storageReads() { return storageReads; },
    get observer() { return observer; },
    MutationObserverImpl
  };
}

function row(id, { hidden = false, hostSnippet = null } = {}) {
  const node = new Node('button');
  node.className = 'conversation-row';
  node.dataset.conversationId = id;
  node.hidden = hidden;
  if (hostSnippet) node.append(hostSnippet);
  return node;
}

function emit(rootListeners, type, event) {
  for (const listener of [...(rootListeners.get(type) || [])]) listener(event);
}

const fixture = build();
const visible = row('visible');
const hidden = row('hidden', { hidden: true });
fixture.list.append(visible, hidden);

const controller = api.createController({
  documentRef: fixture.documentRef,
  rootRef: fixture.rootRef,
  MutationObserverImpl: fixture.MutationObserverImpl
});
assert.equal(controller.mount(), true);
assert.equal(fixture.storageReads, 1);
assert.match(visible.querySelector(`.${api.SNIPPET_CLASS}`).textContent, /needle visible/);
assert.equal(hidden.querySelector(`.${api.SNIPPET_CLASS}`), null, 'hidden row never receives a snippet');

const hostSnippet = new Node('small');
hostSnippet.className = api.SNIPPET_CLASS;
hostSnippet.textContent = 'host late text';
hostSnippet.hidden = true;
const late = row('late', { hostSnippet });
fixture.list.append(late);
fixture.observer.callback();
assert.equal(fixture.rafs.size, 1);
const [rafId, rafCallback] = [...fixture.rafs.entries()][0];
fixture.rafs.delete(rafId);
rafCallback();
assert.match(hostSnippet.textContent, /needle late/);
assert.equal(hostSnippet.hidden, false);
assert.equal(fixture.storageReads, 2);

emit(fixture.rootListeners, 'storage', { key: 'unrelated-key' });
assert.equal(fixture.rafs.size, 0, 'unrelated storage key ignored');
emit(fixture.rootListeners, 'storage', { key: api.STORAGE_KEY });
assert.equal(fixture.rafs.size, 1, 'canonical storage key schedules refresh');
const staleStorageCallback = [...fixture.rafs.values()][0];
const staleObserverCallback = fixture.observer.callback;

const readsBeforeDestroy = fixture.storageReads;
controller.destroy();
assert.equal(fixture.rafs.size, 0);
assert.equal(hostSnippet.textContent, 'host late text');
assert.equal(hostSnippet.hidden, true, 'late host snippet state restored exactly');

emit(fixture.rootListeners, 'storage', { key: api.STORAGE_KEY });
staleStorageCallback();
staleObserverCallback();
assert.equal(fixture.storageReads, readsBeforeDestroy, 'all stale event paths stay storage-inert after destroy');
assert.equal(controller.apply().rows, 0);
assert.equal(controller.queueApply(), false);

console.log('conversation search snippet stale-event tests passed');
