import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-organize.js');

class ClassList {
  constructor() { this.values = new Set(); }
  add(...values) { for (const value of values) this.values.add(value); }
  remove(...values) { for (const value of values) this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force === true) { this.values.add(value); return true; }
    if (force === false) { this.values.delete(value); return false; }
    if (this.values.has(value)) { this.values.delete(value); return false; }
    this.values.add(value); return true;
  }
}

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.classList = new ClassList();
    this.className = '';
    this.textContent = '';
    this.title = '';
    this.value = '';
    this.id = '';
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node?.isFragment) {
        const moving = [...node.children];
        node.children = [];
        this.append(...moving);
        continue;
      }
      node.remove?.();
      node.parentNode = this;
      this.children.push(node);
    }
  }
  insertBefore(node, before) {
    node.remove?.();
    node.parentNode = this;
    const index = before ? this.children.indexOf(before) : -1;
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((node) => node !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) {
    const text = String(value);
    this.attributes.set(name, text);
    if (name === 'class') this.className = text;
    if (name === 'title') this.title = text;
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
      this.dataset[key] = text;
    }
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'title') this.title = '';
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const values = this.listeners.get(type) || [];
    this.listeners.set(type, values.filter((value) => value !== listener));
  }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === 'link[data-hafize-conversation-organize-style]') {
      return this.tagName === 'LINK' && this.hasAttribute('data-hafize-conversation-organize-style');
    }
    return false;
  }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) found.push(child);
      found.push(...(child.querySelectorAll?.(selector) || []));
    }
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function makeRow({ title = 'Host title', titleAttribute = 'Host tooltip', pinned = false, foreignActions = false } = {}) {
  const row = new FakeElement('div');
  row.className = 'conversation-row';
  if (pinned) row.classList.add('conversation-pinned');
  const open = new FakeElement('button');
  open.className = 'conversation-open';
  open.textContent = title;
  open.setAttribute('title', titleAttribute);
  const remove = new FakeElement('button');
  remove.className = 'conversation-delete';
  remove.setAttribute('aria-label', 'Host delete');
  row.append(open);
  if (foreignActions) {
    const actions = new FakeElement('div');
    actions.className = 'conversation-organize-actions';
    actions.textContent = 'foreign';
    row.append(actions);
  }
  row.append(remove);
  return row;
}

function fixture({ observerThrows = false, storageListenerThrows = false, foreignActions = false } = {}) {
  const head = new FakeElement('head');
  const body = new FakeElement('body');
  const list = new FakeElement('div');
  list.id = 'conversationList';
  const row = makeRow({ pinned: true, foreignActions });
  list.append(row);
  body.append(list);
  const fragmentFactory = () => {
    const fragment = new FakeElement('fragment');
    fragment.isFragment = true;
    return fragment;
  };
  const documentRef = {
    head,
    body,
    createElement: (tag) => new FakeElement(tag),
    createDocumentFragment: fragmentFactory,
    querySelector(selector) {
      if (selector === '#conversationList') return list;
      return head.querySelector(selector) || body.querySelector(selector);
    }
  };

  const values = new Map([
    [api.SOURCE_KEY, JSON.stringify([{ id: 'a', title: 'Canonical title' }])],
    [api.STORAGE_KEY, '[]']
  ]);
  const writes = [];
  const localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes.push({ key, value }); values.set(key, value); }
  };
  const rootListeners = new Map();
  let rafId = 0;
  const rafCallbacks = new Map();
  const cancelled = [];
  class MutationObserver {
    constructor(callback) { this.callback = callback; fixture.lastObserver = this; }
    observe() { if (observerThrows) throw new Error('observe failed'); this.observing = true; }
    disconnect() { this.disconnected = true; }
  }
  const root = {
    localStorage,
    MutationObserver,
    requestAnimationFrame(callback) { const id = ++rafId; rafCallbacks.set(id, callback); return id; },
    cancelAnimationFrame(id) { cancelled.push(id); rafCallbacks.delete(id); },
    setTimeout(callback) { const id = ++rafId; rafCallbacks.set(id, callback); return id; },
    clearTimeout(id) { cancelled.push(id); rafCallbacks.delete(id); },
    addEventListener(type, listener) {
      if (storageListenerThrows) throw new Error('listener failed');
      if (!rootListeners.has(type)) rootListeners.set(type, []);
      rootListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const values = rootListeners.get(type) || [];
      rootListeners.set(type, values.filter((value) => value !== listener));
    }
  };
  return { documentRef, root, head, list, row, writes, values, rootListeners, rafCallbacks, cancelled };
}

function firstListener(node, type) {
  const listener = node.listeners.get(type)?.[0];
  assert.equal(typeof listener, 'function', `${type} listener exists`);
  return listener;
}

{
  const f = fixture();
  const controller = api.install(f.documentRef, f.root);
  assert.ok(controller);
  assert.equal(controller.getState().mounted, true);
  assert.equal(api.install(f.documentRef, f.root), null, 'duplicate controller must fail closed');

  const open = f.row.querySelector('.conversation-open');
  const remove = f.row.querySelector('.conversation-delete');
  const actions = f.row.querySelector('.conversation-organize-actions');
  const pin = actions.querySelector('.conversation-pin');
  assert.equal(open.textContent, 'Canonical title');
  assert.equal(open.getAttribute('title'), 'Canonical title');
  assert.equal(remove.getAttribute('aria-label'), 'Canonical title sohbetini sil');
  assert.equal(f.row.classList.contains('conversation-pinned'), false);
  assert.equal(f.row.dataset.conversationOrganizeId, 'a');

  const stalePin = firstListener(pin, 'click');
  stalePin({ preventDefault() {}, stopPropagation() {} });
  assert.equal(f.writes.length, 1, 'live pin click persists metadata');
  assert.equal(f.row.classList.contains('conversation-pinned'), true);

  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false, 'destroy is idempotent');
  assert.equal(open.textContent, 'Host title');
  assert.equal(open.getAttribute('title'), 'Host tooltip');
  assert.equal(remove.getAttribute('aria-label'), 'Host delete');
  assert.equal(f.row.classList.contains('conversation-pinned'), true, 'host pinned state restored exactly');
  assert.equal(Object.prototype.hasOwnProperty.call(f.row.dataset, 'conversationOrganizeId'), false);
  assert.equal(f.row.querySelector('.conversation-organize-actions'), null);
  assert.equal(f.documentRef.querySelector('link[data-hafize-conversation-organize-style]'), null);

  const writesAfterDestroy = f.writes.length;
  stalePin({ preventDefault() {}, stopPropagation() {} });
  assert.equal(f.writes.length, writesAfterDestroy, 'stale click cannot write storage after destroy');
  assert.equal(controller.refresh(), false);

  const remount = api.install(f.documentRef, f.root);
  assert.ok(remount, 'ownership released for clean remount');
  remount.destroy();
}

{
  const f = fixture({ foreignActions: true });
  const foreign = f.row.querySelector('.conversation-organize-actions');
  const controller = api.install(f.documentRef, f.root);
  assert.ok(controller);
  assert.equal(f.row.querySelector('.conversation-organize-actions'), foreign, 'host action surface is not replaced');
  controller.destroy();
  assert.equal(f.row.querySelector('.conversation-organize-actions'), foreign, 'host action surface survives teardown');
  assert.equal(foreign.textContent, 'foreign');
}

{
  const broken = fixture({ observerThrows: true });
  assert.equal(api.install(broken.documentRef, broken.root), null, 'observer failure rolls installation back');
  assert.equal(broken.documentRef.querySelector('link[data-hafize-conversation-organize-style]'), null);
  assert.equal(broken.row.querySelector('.conversation-organize-actions'), null);
  const good = fixture();
  const controller = api.install(good.documentRef, good.root);
  assert.ok(controller);
  controller.destroy();
}

{
  const broken = fixture({ storageListenerThrows: true });
  assert.equal(api.install(broken.documentRef, broken.root), null, 'storage listener failure rolls installation back');
  assert.equal(broken.documentRef.querySelector('link[data-hafize-conversation-organize-style]'), null);
  assert.equal(broken.row.querySelector('.conversation-organize-actions'), null);
}

{
  const f = fixture();
  const controller = api.install(f.documentRef, f.root);
  const storageListener = f.rootListeners.get('storage')?.[0];
  assert.equal(typeof storageListener, 'function');
  storageListener({ key: api.SOURCE_KEY });
  assert.equal(f.rafCallbacks.size, 1, 'storage refresh is deferred once');
  const staleFrame = [...f.rafCallbacks.values()][0];
  controller.destroy();
  assert.equal(f.rafCallbacks.size, 0, 'pending frame cancelled at teardown');
  const writes = f.writes.length;
  staleFrame();
  assert.equal(f.writes.length, writes, 'stale deferred render cannot persist after teardown');
}

console.log('conversation organize lifecycle tests passed');