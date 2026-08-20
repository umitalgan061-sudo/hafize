import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scheduleList = require('../public/schedule-list.js');

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const items = this.listeners.get(type) || [];
    items.push(listener);
    this.listeners.set(type, items);
  }
  removeEventListener(type, listener) {
    const items = this.listeners.get(type) || [];
    this.listeners.set(type, items.filter((item) => item !== listener));
  }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener.call(this, event);
  }
}

class FakeElement extends FakeTarget {
  constructor(tagName, documentRef) {
    super();
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = documentRef;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.id = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === 'link[data-hafize-schedule-list-style]') {
      return this.tagName === 'LINK' && this.attributes.has('data-hafize-schedule-list-style');
    }
    return false;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.head = new FakeElement('head', this);
    this.body = new FakeElement('body', this);
    this.rail = new FakeElement('aside', this);
    this.rail.className = 'utility-rail';
    this.body.append(this.rail);
  }
  createElement(tagName) { return new FakeElement(tagName, this); }
  querySelector(selector) {
    if (selector === '.utility-rail') return this.rail;
    return this.head.querySelector(selector) || this.body.querySelector(selector);
  }
}

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
  }
  observe() {}
  disconnect() { this.disconnected = true; }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createRoot(fetchImpl) {
  const root = new FakeTarget();
  root.fetch = fetchImpl;
  root.AbortController = AbortController;
  root.setTimeout = setTimeout;
  root.clearTimeout = clearTimeout;
  root.MutationObserver = FakeMutationObserver;
  return root;
}

function okResponse(schedules = [], listMeta = { snapshot: null, nextOffset: null, total: schedules.length }) {
  return {
    ok: true,
    status: 200,
    async json() { return { ok: true, schedules, listMeta }; }
  };
}

{
  const documentRef = new FakeDocument();
  const pending = deferred();
  let requestSignal;
  const root = createRoot(async (_path, init) => {
    requestSignal = init.signal;
    return pending.promise;
  });
  const controller = scheduleList.mount(documentRef, root, { timeoutMs: 5_000 });
  assert.ok(controller);
  assert.equal(controller.getState().busy, true);
  assert.equal(documentRef.querySelector('#scheduleListCard') != null, true);
  assert.equal(requestSignal.aborted, false);

  assert.equal(controller.destroy(), true);
  assert.equal(requestSignal.aborted, true);
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
  assert.equal(controller.destroy(), false);

  pending.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
}

{
  const documentRef = new FakeDocument();
  const first = deferred();
  const calls = [];
  const root = createRoot(async (path, init) => {
    calls.push({ path, signal: init.signal });
    if (calls.length === 1) return first.promise;
    return okResponse();
  });
  const controller = scheduleList.mount(documentRef, root, { timeoutMs: 5_000 });
  assert.ok(controller);
  assert.equal(calls.length, 1);
  assert.equal(controller.setScope('failed'), true);
  assert.equal(calls[0].signal.aborted, true);
  first.reject(Object.assign(new Error('scope switched'), { name: 'AbortError' }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(calls.length, 2);
  assert.match(calls[1].path, /scope=failed/);
  assert.equal(controller.getState().scope, 'failed');
  assert.equal(controller.getState().busy, false);
  controller.destroy();
}

{
  const documentRef = new FakeDocument();
  const first = deferred();
  let calls = 0;
  const root = createRoot(async () => {
    calls += 1;
    if (calls === 1) return first.promise;
    return okResponse();
  });
  const controller = scheduleList.mount(documentRef, root, { timeoutMs: 5_000 });
  assert.ok(controller);
  assert.equal(controller.refresh({ reason: 'manual' }), true);
  assert.equal(controller.getState().pendingMutationRefresh, true);
  first.resolve(okResponse());
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(calls, 2);
  assert.equal(controller.getState().pendingMutationRefresh, false);
  assert.equal(controller.getState().busy, false);
  controller.destroy();
}

{
  const documentRef = new FakeDocument();
  const root = createRoot(async () => okResponse());
  const controller = scheduleList.mount(documentRef, root, { timeoutMs: 5_000 });
  assert.ok(controller);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(controller.getState().busy, false);
  assert.equal(documentRef.querySelector('#scheduleListCard') != null, true);
  controller.destroy();
}

console.log('schedule list controller lifecycle tests passed');
