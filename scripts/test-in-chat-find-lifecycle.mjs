import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const find = require('../public/in-chat-find.js');

function listenerTarget(initial = {}) {
  const listeners = new Map();
  return {
    ...initial,
    addEventListener(type, handler) {
      const set = listeners.get(type) || new Set();
      set.add(handler);
      listeners.set(type, set);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
    emit(type, event = {}) {
      for (const handler of [...(listeners.get(type) || [])]) handler({ ...event, currentTarget: this });
    }
  };
}

function classList(...values) {
  const set = new Set(values);
  return {
    contains: (value) => set.has(value),
    add: (value) => set.add(value),
    remove: (value) => set.delete(value),
    has: (value) => set.has(value)
  };
}

function createElement(tagName, registry) {
  const element = listenerTarget({
    tagName: String(tagName).toUpperCase(),
    id: '',
    className: '',
    hidden: false,
    disabled: false,
    value: '',
    textContent: '',
    children: [],
    parentNode: null,
    removed: false,
    attributes: new Map(),
    classList: classList(),
    focusCalls: 0,
    selectCalls: 0,
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; },
    hasAttribute(name) { return this.attributes.has(name); },
    removeAttribute(name) { this.attributes.delete(name); },
    focus() { this.focusCalls += 1; },
    select() { this.selectCalls += 1; },
    append(...children) {
      for (const child of children) {
        child.parentNode = this;
        this.children.push(child);
        if (child.id) registry.set(child.id, child);
      }
    },
    remove() {
      this.removed = true;
      if (this.id) registry.delete(this.id);
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    },
    querySelector(selector) {
      if (selector === 'input') return this.children.find((child) => child.tagName === 'INPUT') || null;
      if (selector === '.in-chat-find-status') return this.children.find((child) => child.className === 'in-chat-find-status') || null;
      if (selector === '.content') return this.contentNode || null;
      if (selector.startsWith('#')) return registry.get(selector.slice(1)) || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button') return this.children.filter((child) => child.tagName === 'BUTTON');
      if (selector === '.message') return this.messageRows || [];
      return [];
    },
    scrollIntoView(options) { this.scroll = options; }
  });
  return element;
}

function createFindControl(registry) {
  const wrapper = createElement('div', registry);
  wrapper.id = find.CONTROL_ID;
  wrapper.hidden = true;
  const input = createElement('input', registry);
  const status = createElement('span', registry);
  status.className = 'in-chat-find-status';
  status.textContent = 'host status';
  const previous = createElement('button', registry);
  previous.disabled = true;
  const next = createElement('button', registry);
  next.disabled = false;
  const close = createElement('button', registry);
  wrapper.append(input, status, previous, next, close);
  registry.set(wrapper.id, wrapper);
  return { wrapper, input, status, previous, next, close };
}

function createHarness({ preexisting = false, includeMessages = true, observerThrows = false } = {}) {
  const registry = new Map();
  const docListeners = new Map();
  const observers = [];
  const head = createElement('head', registry);
  const body = createElement('body', registry);
  const historyHead = createElement('div', registry);
  historyHead.className = 'history-head';
  const messages = createElement('section', registry);
  messages.id = 'messages';
  registry.set(messages.id, messages);

  const article = createElement('article', registry);
  article.classList = classList('message');
  article.contentNode = { textContent: 'Merhaba Hafize' };
  messages.messageRows = [article];

  let existingTrigger = null;
  let existingControl = null;
  if (preexisting) {
    existingTrigger = createElement('button', registry);
    existingTrigger.id = find.TRIGGER_ID;
    existingTrigger.setAttribute('aria-expanded', 'host-value');
    historyHead.append(existingTrigger);
    registry.set(existingTrigger.id, existingTrigger);
    existingControl = createFindControl(registry);
    body.append(existingControl.wrapper);
  }

  const documentRef = {
    head,
    body,
    activeElement: null,
    createElement(tagName) { return createElement(tagName, registry); },
    querySelector(selector) {
      if (selector === '.history-head') return historyHead;
      if (selector === '#messages') return includeMessages ? messages : null;
      if (selector.startsWith('#')) return registry.get(selector.slice(1)) || null;
      return null;
    },
    addEventListener(type, handler) {
      const set = docListeners.get(type) || new Set();
      set.add(handler);
      docListeners.set(type, set);
    },
    removeEventListener(type, handler) { docListeners.get(type)?.delete(handler); },
    listenerCount(type) { return docListeners.get(type)?.size || 0; }
  };

  class MutationObserverImpl {
    constructor(callback) {
      this.callback = callback;
      this.observeCalls = 0;
      this.disconnectCalls = 0;
      observers.push(this);
    }
    observe(target, options) {
      assert.equal(target, messages);
      assert.deepEqual(options, { childList: true, subtree: true, characterData: true });
      this.observeCalls += 1;
      if (observerThrows) throw new Error('observe failed');
    }
    disconnect() { this.disconnectCalls += 1; }
    fire() { this.callback(); }
  }

  return { registry, documentRef, MutationObserverImpl, observers, historyHead, messages, article, existingTrigger, existingControl };
}

{
  const harness = createHarness();
  const controller = find.createController(harness);
  assert.equal(controller.isMounted(), false);
  assert.equal(controller.mount(), true);
  assert.equal(controller.isMounted(), true);
  assert.equal(controller.mount(), true, 'double mount should be idempotent');
  assert.equal(harness.observers.length, 1);
  assert.equal(harness.documentRef.listenerCount('keydown'), 1);

  const trigger = harness.registry.get(find.TRIGGER_ID);
  const control = harness.registry.get(find.CONTROL_ID);
  const input = control.querySelector('input');
  const [previous, next, close] = control.querySelectorAll('button');
  assert.equal(trigger.listenerCount('click'), 1);
  assert.equal(input.listenerCount('input'), 1);
  assert.equal(previous.listenerCount('click'), 1);
  assert.equal(next.listenerCount('click'), 1);
  assert.equal(close.listenerCount('click'), 1);

  input.value = 'hafize';
  assert.equal(controller.open(trigger), true);
  assert.equal(control.hidden, false);
  assert.equal(input.focusCalls, 1);
  assert.equal(harness.article.classList.has(find.ACTIVE_CLASS), true);
  assert.equal(harness.article.classList.has(find.CURRENT_CLASS), true);
  assert.equal(controller.destroy(), true);
  assert.equal(controller.isMounted(), false);
  assert.equal(harness.observers[0].disconnectCalls, 1);
  assert.equal(harness.documentRef.listenerCount('keydown'), 0);
  assert.equal(trigger.listenerCount('click'), 0);
  assert.equal(input.listenerCount('input'), 0);
  assert.equal(previous.listenerCount('click'), 0);
  assert.equal(next.listenerCount('click'), 0);
  assert.equal(close.listenerCount('click'), 0);
  assert.equal(trigger.removed, true);
  assert.equal(control.removed, true);
  assert.equal(harness.article.classList.has(find.ACTIVE_CLASS), false);
  assert.equal(harness.article.classList.has(find.CURRENT_CLASS), false);
  assert.equal(controller.destroy(), false);
  assert.equal(controller.open(), false);
  assert.equal(controller.apply(), false);
  assert.equal(controller.step(1), false);

  assert.equal(controller.mount(), true, 'controller should support clean remount');
  assert.equal(harness.observers.length, 2);
  assert.equal(harness.documentRef.listenerCount('keydown'), 1);
  assert.equal(controller.destroy(), true);
}

{
  const harness = createHarness({ preexisting: true });
  const controller = find.createController(harness);
  const { wrapper, input, status, previous, next, close } = harness.existingControl;
  assert.equal(controller.mount(), true);
  input.value = 'hafize';
  assert.equal(controller.open(harness.existingTrigger), true);
  assert.equal(wrapper.hidden, false);
  assert.equal(harness.existingTrigger.getAttribute('aria-expanded'), 'true');
  assert.equal(status.textContent, '1/1');
  assert.equal(previous.disabled, false);
  assert.equal(next.disabled, false);

  assert.equal(controller.destroy(), true);
  assert.equal(harness.existingTrigger.removed, false, 'host trigger must survive');
  assert.equal(wrapper.removed, false, 'host control must survive');
  assert.equal(harness.existingTrigger.getAttribute('aria-expanded'), 'host-value');
  assert.equal(wrapper.hidden, true);
  assert.equal(status.textContent, 'host status');
  assert.equal(previous.disabled, true);
  assert.equal(next.disabled, false);
  assert.equal(harness.existingTrigger.listenerCount('click'), 0);
  assert.equal(input.listenerCount('input'), 0);
  assert.equal(close.listenerCount('click'), 0);
}

{
  const harness = createHarness({ includeMessages: false });
  const controller = find.createController(harness);
  assert.equal(controller.mount(), false, 'missing messages must fail closed');
  assert.equal(controller.isMounted(), false);
  assert.equal(harness.observers.length, 0);
  assert.equal(harness.documentRef.listenerCount('keydown'), 0);
  assert.equal(harness.registry.get(find.TRIGGER_ID), undefined);
  assert.equal(harness.registry.get(find.CONTROL_ID), undefined);
}

{
  const harness = createHarness({ preexisting: true, observerThrows: true });
  const controller = find.createController(harness);
  const { wrapper, input, status, previous, next } = harness.existingControl;
  assert.equal(controller.mount(), false, 'observer setup failure must roll back');
  assert.equal(controller.isMounted(), false);
  assert.equal(harness.observers[0].disconnectCalls, 1);
  assert.equal(harness.documentRef.listenerCount('keydown'), 0);
  assert.equal(harness.existingTrigger.listenerCount('click'), 0);
  assert.equal(input.listenerCount('input'), 0);
  assert.equal(harness.existingTrigger.getAttribute('aria-expanded'), 'host-value');
  assert.equal(wrapper.hidden, true);
  assert.equal(status.textContent, 'host status');
  assert.equal(previous.disabled, true);
  assert.equal(next.disabled, false);
}

console.log('in-chat find lifecycle tests passed');