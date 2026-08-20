import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-pr-merge.js');

class Node {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.value = '';
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((entry) => entry !== listener));
  }
  focus() {}
  matches(selector) {
    if (selector === '[data-github-pr-merge]') return this.getAttribute('data-github-pr-merge') !== null;
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
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

function fixture({ observeThrows = false, timerThrows = false } = {}) {
  const body = new Node('body');
  const documentListeners = new Map();
  const documentRef = {
    body,
    createElement: (tag) => new Node(tag),
    querySelector(selector) { return body.querySelector(selector); },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      documentListeners.set(type, (documentListeners.get(type) || []).filter((entry) => entry !== listener));
    }
  };
  const observers = [];
  const clearedTimers = [];
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target, options) {
      assert.equal(target, body);
      assert.deepEqual(options, { childList: true, subtree: true });
      if (observeThrows) throw new Error('observe failed');
    }
    disconnect() { this.disconnected = true; }
  }
  const rootRef = {
    AbortController,
    MutationObserver: Observer,
    setTimeout(callback, delay) {
      if (timerThrows) throw new Error('timer failed');
      assert.equal(delay, api.MOUNT_TIMEOUT_MS);
      this.timerCallback = callback;
      return 77;
    },
    clearTimeout(timer) { clearedTimers.push(timer); },
    CustomEvent: class {}
  };
  return { body, documentRef, rootRef, observers, clearedTimers };
}

function addCard(f) {
  const card = new Node('section');
  card.id = 'githubWriteReadinessCard';
  f.body.append(card);
  return card;
}

{
  const f = fixture();
  const controller = api.createController({
    documentRef: f.documentRef,
    rootRef: f.rootRef,
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })
  });
  assert.equal(controller.mount(), false, 'controller waits when host card is not present');
  assert.equal(f.observers.length, 1);
  assert.equal(f.observers[0].disconnected, false);

  const card = addCard(f);
  f.observers[0].callback();
  assert.equal(controller.isMounted(), true, 'observer mounts when host card arrives');
  assert.ok(card.querySelector('[data-github-pr-merge]'));
  assert.equal(f.observers[0].disconnected, true, 'waiting observer stops after mount');
  assert.deepEqual(f.clearedTimers, [77], 'waiting timeout cleared after mount');
  controller.destroy();
}

{
  const f = fixture({ observeThrows: true });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: async () => ({ ok: true }) });
  assert.equal(controller.mount(), false, 'observer setup failure fails closed');
  assert.equal(f.observers[0].disconnected, true, 'failed observer is disconnected');
  assert.deepEqual(f.clearedTimers, []);
}

{
  const f = fixture({ timerThrows: true });
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: async () => ({ ok: true }) });
  assert.equal(controller.mount(), false, 'timer setup failure fails closed');
  assert.equal(f.observers[0].disconnected, true, 'observer rolled back when timer setup fails');
}

{
  const f = fixture();
  const controller = api.createController({ documentRef: f.documentRef, rootRef: f.rootRef, fetchImpl: async () => ({ ok: true }) });
  controller.mount();
  assert.equal(controller.destroy(), true);
  assert.equal(f.observers[0].disconnected, true);
  assert.deepEqual(f.clearedTimers, [77], 'destroy clears waiting timeout');
  assert.equal(controller.destroy(), false);
  addCard(f);
  f.observers[0].callback();
  assert.equal(controller.isMounted(), false, 'destroyed waiting controller cannot mount later');
}

console.log('github PR merge auto-mount lifecycle tests passed');
