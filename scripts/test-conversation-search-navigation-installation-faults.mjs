import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-search-navigation.js');

class FakeElement {
  constructor(tag = 'div', hooks = {}) {
    this.tagName = String(tag).toUpperCase();
    this.hooks = hooks;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
  }
  append(...nodes) {
    if (this.hooks.throwOnAppend?.(this, nodes)) throw new Error('append failed');
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
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      this.dataset[key] = String(value);
    }
  }
  addEventListener(type, listener) {
    if (this.hooks.throwOnListener?.(this, type)) throw new Error('listener failed');
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry !== listener));
  }
  focus() {}
  contains(target) {
    return target === this || this.children.some((child) => child.contains?.(target));
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    const match = selector.match(/^\[data-direction="(-?\d+)"\]$/);
    if (match) return this.dataset.direction === match[1];
    return false;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const result = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) result.push(child);
      result.push(...(child.querySelectorAll?.(selector) || []));
    }
    return result;
  }
}

function fixture({ throwOnListener, throwOnAppend } = {}) {
  const hooks = { throwOnListener, throwOnAppend };
  const html = new FakeElement('html', hooks);
  const head = new FakeElement('head', hooks);
  const body = new FakeElement('body', hooks);
  html.append(head, body);
  const control = new FakeElement('div', hooks);
  control.id = api.CONTROL_ID;
  const input = new FakeElement('input', hooks);
  input.id = api.INPUT_ID;
  const list = new FakeElement('div', hooks);
  list.id = api.LIST_ID;
  const row = new FakeElement('div', hooks);
  row.className = 'conversation-row';
  const open = new FakeElement('button', hooks);
  open.className = 'conversation-open';
  row.append(open);
  list.append(row);
  control.append(input);
  body.append(control, list);

  const documentListeners = new Map();
  const documentRef = {
    head,
    body,
    createElement: (tag) => new FakeElement(tag, hooks),
    getElementById(id) { return html.querySelector(`#${id}`); },
    querySelector(selector) { return html.querySelector(selector); },
    addEventListener(type, listener) {
      if (throwOnListener?.({ className: 'document' }, type)) throw new Error('document listener failed');
      if (!documentListeners.has(type)) documentListeners.set(type, []);
      documentListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const entries = documentListeners.get(type) || [];
      documentListeners.set(type, entries.filter((entry) => entry !== listener));
    }
  };
  return { hooks, html, head, body, control, input, list, row, open, documentRef, documentListeners };
}

function assertClean(f) {
  assert.equal(f.documentRef.getElementById(api.NAV_ID), null, 'navigation rolled back');
  assert.equal(f.documentRef.getElementById(api.STYLE_ID), null, 'owned style rolled back');
  assert.equal((f.input.listeners.get('input') || []).length, 0, 'input listener rolled back');
  assert.equal((f.documentListeners.get('keydown') || []).length, 0, 'document listener rolled back');
}

{
  const f = fixture({
    throwOnListener(node, type) {
      return node?.dataset?.direction === '1' && type === 'click';
    }
  });
  const ControllerObserver = class { observe() {} disconnect() {} };
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: ControllerObserver });
  assert.equal(controller.mount(), false, 'partial click listener installation fails closed');
  assertClean(f);
  assert.equal(controller.destroy(), true);

  f.hooks.throwOnListener = null;
  const retry = api.createController({ documentRef: f.documentRef, MutationObserverImpl: ControllerObserver });
  assert.equal(retry.mount(), true, 'failed installation releases ownership for retry');
  retry.destroy();
}

{
  const f = fixture({
    throwOnListener(node, type) {
      return node?.className === 'document' && type === 'keydown';
    }
  });
  const ControllerObserver = class { observe() {} disconnect() {} };
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: ControllerObserver });
  assert.equal(controller.mount(), false, 'document listener failure rolls back prior listeners');
  assertClean(f);
}

{
  const f = fixture();
  let disconnected = 0;
  class ThrowingObserver {
    constructor(callback) { this.callback = callback; }
    observe() { throw new Error('observe failed'); }
    disconnect() { disconnected += 1; }
  }
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: ThrowingObserver });
  assert.equal(controller.mount(), false, 'observer failure fails closed');
  assert.equal(disconnected, 1, 'partially constructed observer disconnected');
  assertClean(f);
}

{
  const f = fixture();
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: {} });
  assert.equal(controller.mount(), false, 'non-callable observer implementation is rejected');
  assertClean(f);
}

{
  const f = fixture();
  const foreignStyle = new FakeElement('style');
  foreignStyle.id = api.STYLE_ID;
  foreignStyle.textContent = 'host-owned-style';
  f.head.append(foreignStyle);
  const Observer = class { observe() {} disconnect() {} };
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: Observer });
  assert.equal(controller.mount(), true);
  assert.equal(f.documentRef.getElementById(api.STYLE_ID), foreignStyle, 'existing style is reused but not owned');
  assert.equal(controller.destroy(), true);
  assert.equal(f.documentRef.getElementById(api.STYLE_ID), foreignStyle, 'host style survives teardown');
}

{
  const f = fixture();
  const foreignNavigation = new FakeElement('div');
  foreignNavigation.id = api.NAV_ID;
  foreignNavigation.textContent = 'foreign navigation';
  f.control.append(foreignNavigation);
  const Observer = class { observe() {} disconnect() {} };
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: Observer });
  assert.equal(controller.mount(), false, 'pre-existing navigation surface is not silently adopted');
  assert.equal(f.documentRef.getElementById(api.NAV_ID), foreignNavigation);
  assert.equal(f.documentRef.getElementById(api.STYLE_ID), null, 'no style created when foreign nav blocks mount');
}

{
  const f = fixture();
  const originalCreate = f.documentRef.createElement;
  f.documentRef.createElement = (tag) => {
    const node = originalCreate(tag);
    if (tag === 'div') {
      const originalQuery = node.querySelector.bind(node);
      node.querySelector = (selector) => selector === '[data-direction="1"]' ? null : originalQuery(selector);
    }
    return node;
  };
  const Observer = class { observe() {} disconnect() {} };
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: Observer });
  assert.equal(controller.mount(), false, 'malformed generated surface is rolled back');
  assertClean(f);
}

{
  const f = fixture({
    throwOnAppend(node, nodes) {
      return node?.id === api.CONTROL_ID && nodes.some((candidate) => candidate?.id === api.NAV_ID);
    }
  });
  const Observer = class { observe() {} disconnect() {} };
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: Observer });
  assert.equal(controller.mount(), false, 'navigation append failure does not leak style or ownership');
  assertClean(f);
}

{
  const f = fixture();
  const controller = api.createController({ documentRef: f.documentRef, MutationObserverImpl: null });
  assert.equal(controller.mount(), true, 'observer is optional when explicitly disabled');
  assert.equal(controller.destroy(), true);
  assertClean(f);
}

{
  const f = fixture();
  delete f.documentRef.body;
  const badDocument = { querySelector: f.documentRef.querySelector, createElement: null };
  assert.throws(() => api.createController({ documentRef: badDocument }), /INVALID_CONVERSATION_SEARCH_NAV_DOCUMENT/);
}

console.log('conversation search navigation installation fault tests passed');
