import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-search.js');

class Element {
  constructor() {
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.hidden = false;
    this.id = '';
    this.className = '';
    this.dataset = {};
    this.value = '';
    this.textContent = '';
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
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
  }
  setAttribute() {}
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
  focus() {}
}

function fixture() {
  const head = new Element();
  const body = new Element();
  const history = new Element();
  const list = new Element();
  history.className = 'history-block';
  list.id = 'conversationList';
  history.append(list);
  body.append(history);

  const row = new Element();
  row.className = 'conversation-row';
  row.dataset.conversationId = 'a';
  const button = new Element();
  button.className = 'conversation-open';
  button.textContent = 'Alpha';
  row.append(button);
  list.append(row);

  const documentRef = {
    head,
    body,
    createElement() { return new Element(); },
    querySelector(selector) {
      if (selector === '.history-block') return history;
      if (selector === '#conversationList') return list;
      return body.querySelector(selector) || head.querySelector(selector);
    }
  };

  const timers = new Map();
  const listeners = new Map();
  let timerId = 0;
  const rootRef = {
    localStorage: { getItem() { return '[]'; } },
    HafizeConversationStorageGuard: {
      STORAGE_KEY: 'safe',
      sanitizeStoredValue() { return { value: [] }; }
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== listener));
    },
    setTimeout(callback, delay) {
      assert.equal(delay, 0);
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };

  class MutationObserverImpl {
    constructor(callback) { this.callback = callback; MutationObserverImpl.last = this; }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }

  return { documentRef, rootRef, list, row, timers, listeners, MutationObserverImpl };
}

const f = fixture();
const controller = api.createController({
  documentRef: f.documentRef,
  rootRef: f.rootRef,
  MutationObserverImpl: f.MutationObserverImpl
});
assert.equal(controller.mount(), true);

const input = f.documentRef.querySelector('#' + api.INPUT_ID);
input.value = 'alpha';
controller.apply();
assert.equal(controller.queueRefresh(), true);
assert.equal(controller.queueRefresh(), false, 'refreshes coalesce');
assert.equal(f.timers.size, 1);

const newRow = new Element();
newRow.className = 'conversation-row';
newRow.dataset.conversationId = 'b';
newRow.hidden = true;
const newButton = new Element();
newButton.className = 'conversation-open';
newButton.textContent = 'Alpha second';
newRow.append(newButton);
f.list.append(newRow);

const timer = [...f.timers.values()][0];
f.timers.clear();
timer();
assert.equal(newRow.hidden, true, 'dynamic host-hidden row remains hidden');

const storage = (f.listeners.get('storage') || [])[0];
storage({ key: 'wrong' });
assert.equal(f.timers.size, 0);
storage({ key: 'safe' });
assert.equal(f.timers.size, 1);

const stale = [...f.timers.values()][0];
assert.equal(controller.destroy(), true);
assert.equal(f.timers.size, 0);
stale();
assert.equal(newRow.hidden, true, 'stale timer stays inert after destroy');

console.log('conversation search refresh lifecycle tests passed');
