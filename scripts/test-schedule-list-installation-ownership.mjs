import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const scheduleList = require('../public/schedule-list.js');

class FakeTarget {
  constructor({ failAddAt = null } = {}) {
    this.listeners = new Map();
    this.addCalls = 0;
    this.failAddAt = failAddAt;
  }

  addEventListener(type, listener) {
    this.addCalls += 1;
    if (this.failAddAt === this.addCalls) throw new Error('listener install failed');
    const entries = this.listeners.get(type) || [];
    entries.push(listener);
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry !== listener));
  }

  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener.call(this, event);
  }

  listenerCount() {
    return [...this.listeners.values()].reduce((total, entries) => total + entries.length, 0);
  }
}

class FakeElement extends FakeTarget {
  constructor(tagName, documentRef, options = {}) {
    super(options);
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
    this.rel = '';
    this.href = '';
  }

  setAttribute(name, value) {
    const text = String(value);
    this.attributes.set(name, text);
    if (name === 'id') this.id = text;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

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
  constructor({ buttonFailAddAt = null, withSessionBadge = false } = {}) {
    this.head = new FakeElement('head', this);
    this.body = new FakeElement('body', this);
    this.rail = new FakeElement('aside', this);
    this.rail.className = 'utility-rail';
    this.body.append(this.rail);
    this.buttonFailAddAt = buttonFailAddAt;
    if (withSessionBadge) {
      this.sessionBadge = new FakeElement('span', this);
      this.sessionBadge.id = 'sessionBadge';
      this.sessionBadge.dataset.state = 'active';
      this.body.append(this.sessionBadge);
    } else {
      this.sessionBadge = null;
    }
  }

  createElement(tagName) {
    const options = String(tagName).toLowerCase() === 'button'
      ? { failAddAt: this.buttonFailAddAt }
      : {};
    return new FakeElement(tagName, this, options);
  }

  querySelector(selector) {
    if (selector === '.utility-rail') return this.rail;
    return this.head.querySelector(selector) || this.body.querySelector(selector);
  }
}

class FakeMutationObserver {
  constructor(callback, { failObserve = false } = {}) {
    this.callback = callback;
    this.failObserve = failObserve;
    this.disconnected = false;
  }

  observe() {
    if (this.failObserve) throw new Error('observer install failed');
  }

  disconnect() {
    this.disconnected = true;
  }
}

function okResponse() {
  return {
    ok: true,
    status: 200,
    async json() {
      return { ok: true, schedules: [], listMeta: { snapshot: null, nextOffset: null, total: 0 } };
    }
  };
}

function createRoot({ failRootAddAt = null, failObserve = false, malformedEvents = false } = {}) {
  const root = new FakeTarget({ failAddAt: failRootAddAt });
  root.fetch = async () => okResponse();
  root.AbortController = AbortController;
  root.setTimeout = setTimeout;
  root.clearTimeout = clearTimeout;
  root.MutationObserver = class extends FakeMutationObserver {
    constructor(callback) { super(callback, { failObserve }); }
  };
  if (malformedEvents) root.removeEventListener = undefined;
  return root;
}

function addHostStyle(documentRef) {
  const style = documentRef.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/host-schedule-list.css';
  style.setAttribute('data-hafize-schedule-list-style', 'host');
  documentRef.head.append(style);
  return style;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

{
  const documentRef = new FakeDocument();
  const root = createRoot();
  root.fetch = null;

  assert.equal(scheduleList.mount(documentRef, root), null);
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
  assert.equal(documentRef.querySelector('link[data-hafize-schedule-list-style]'), null);
  assert.equal(root.listenerCount(), 0);
}

{
  const documentRef = new FakeDocument({ buttonFailAddAt: 1 });
  const root = createRoot();

  assert.equal(scheduleList.mount(documentRef, root), null);
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
  assert.equal(documentRef.querySelector('link[data-hafize-schedule-list-style]'), null);
  assert.equal(root.listenerCount(), 0);

  documentRef.buttonFailAddAt = null;
  const retry = scheduleList.mount(documentRef, root);
  assert.ok(retry);
  retry.destroy();
}

{
  const documentRef = new FakeDocument();
  const root = createRoot({ failRootAddAt: 3 });

  assert.equal(scheduleList.mount(documentRef, root), null);
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
  assert.equal(documentRef.querySelector('link[data-hafize-schedule-list-style]'), null);
  assert.equal(root.listenerCount(), 0);
}

{
  const documentRef = new FakeDocument({ withSessionBadge: true });
  const root = createRoot({ failObserve: true });

  assert.equal(scheduleList.mount(documentRef, root), null);
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
  assert.equal(documentRef.querySelector('link[data-hafize-schedule-list-style]'), null);
  assert.equal(root.listenerCount(), 0);
}

{
  const documentRef = new FakeDocument();
  const root = createRoot({ malformedEvents: true });

  assert.equal(scheduleList.mount(documentRef, root), null);
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
  assert.equal(documentRef.querySelector('link[data-hafize-schedule-list-style]'), null);
}

{
  const documentRef = new FakeDocument();
  const hostStyle = addHostStyle(documentRef);
  const root = createRoot();
  const controller = scheduleList.mount(documentRef, root);

  assert.ok(controller);
  await flush();
  assert.equal(documentRef.querySelector('link[data-hafize-schedule-list-style]'), hostStyle);
  assert.equal(controller.destroy(), true);
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
  assert.equal(documentRef.querySelector('link[data-hafize-schedule-list-style]'), hostStyle);
  assert.equal(root.listenerCount(), 0);
}

{
  const documentRef = new FakeDocument();
  const root = createRoot();
  const controller = scheduleList.mount(documentRef, root);

  assert.ok(controller);
  await flush();
  const ownedStyle = documentRef.querySelector('link[data-hafize-schedule-list-style]');
  assert.ok(ownedStyle);
  assert.equal(root.listenerCount(), 4);

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);
  assert.equal(documentRef.querySelector('link[data-hafize-schedule-list-style]'), null);
  assert.equal(root.listenerCount(), 0);

  const remount = scheduleList.mount(documentRef, root);
  assert.ok(remount);
  await flush();
  assert.notEqual(documentRef.querySelector('link[data-hafize-schedule-list-style]'), ownedStyle);
  remount.destroy();
}

{
  const documentRef = new FakeDocument();
  const root = createRoot();
  const controller = scheduleList.mount(documentRef, root);

  assert.ok(controller);
  await flush();
  documentRef.querySelector('#scheduleListCard').remove();
  assert.equal(documentRef.querySelector('#scheduleListCard'), null);

  assert.equal(scheduleList.mount(documentRef, root), null);
  assert.equal(root.listenerCount(), 4);
  assert.equal(controller.destroy(), true);
  assert.equal(root.listenerCount(), 0);

  const remount = scheduleList.mount(documentRef, root);
  assert.ok(remount);
  remount.destroy();
}

{
  const documentRef = new FakeDocument();
  const root = createRoot();
  const controller = scheduleList.mount(documentRef, root);
  assert.ok(controller);
  await flush();

  const before = controller.getState();
  assert.equal(before.busy, false);
  assert.equal(controller.destroy(), true);
  assert.equal(controller.refresh(), false);
  assert.equal(controller.setScope('failed'), false);
  assert.equal(await controller.loadMore(), false);
}

{
  const documentRef = new FakeDocument();
  const root = createRoot();
  class BrokenAbortController {
    constructor() { throw new Error('constructor unavailable'); }
  }
  root.AbortController = BrokenAbortController;
  const controller = scheduleList.mount(documentRef, root);

  assert.ok(controller);
  await flush();
  assert.equal(controller.getState().busy, false);
  const status = documentRef.querySelector('.schedule-list-status');
  assert.equal(status.dataset.state, 'error');
  assert.match(status.textContent, /başlatılamadı/);
  controller.destroy();
}

console.log('schedule list installation ownership tests passed');