import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const navigation = require('../public/conversation-search-navigation.js');

function createListenerTarget(initial = {}) {
  const listeners = new Map();
  return {
    ...initial,
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || new Set();
      handlers.add(handler);
      listeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
    dispatch(type, event = {}) {
      for (const handler of [...(listeners.get(type) || [])]) handler({ ...event, currentTarget: this });
    }
  };
}

function createElement(tagName, registry) {
  const element = createListenerTarget({
    tagName: String(tagName).toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    hidden: false,
    disabled: false,
    dataset: {},
    children: [],
    parentNode: null,
    removed: false,
    attributes: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
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
    contains(target) {
      if (target === this) return true;
      return this.children.some((child) => child === target || child.contains?.(target));
    },
    querySelector(selector) {
      if (selector === '[data-direction="-1"]') return this.children.find((child) => child.dataset?.direction === '-1') || null;
      if (selector === '[data-direction="1"]') return this.children.find((child) => child.dataset?.direction === '1') || null;
      if (selector.startsWith('#')) return registry.get(selector.slice(1)) || null;
      if (selector === '.conversation-open') return this.openButton || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.conversation-row') return this.rows || [];
      return [];
    }
  });
  return element;
}

function createHarness({ existingNavigation = false } = {}) {
  const registry = new Map();
  const documentListeners = new Map();
  const observers = [];
  const control = createElement('div', registry);
  const input = createElement('input', registry);
  const list = createElement('div', registry);
  const head = createElement('head', registry);
  control.id = navigation.CONTROL_ID;
  input.id = navigation.INPUT_ID;
  input.value = 'aranan';
  list.id = navigation.LIST_ID;
  registry.set(control.id, control);
  registry.set(input.id, input);
  registry.set(list.id, list);

  const resultButton = createListenerTarget({
    id: 'conversation-result',
    focusCalls: 0,
    focus() { this.focusCalls += 1; }
  });
  const row = createElement('div', registry);
  row.openButton = resultButton;
  list.rows = [row];

  function appendPreexistingNavigation() {
    const wrapper = createElement('div', registry);
    wrapper.id = navigation.NAV_ID;
    const previous = createElement('button', registry);
    previous.dataset.direction = '-1';
    const next = createElement('button', registry);
    next.dataset.direction = '1';
    const status = createElement('small', registry);
    status.id = navigation.STATUS_ID;
    wrapper.append(previous, next, status);
    control.append(wrapper);
    registry.set(wrapper.id, wrapper);
    return wrapper;
  }

  const preexisting = existingNavigation ? appendPreexistingNavigation() : null;

  const documentRef = {
    head,
    activeElement: input,
    createElement(tagName) {
      return createElement(tagName, registry);
    },
    getElementById(id) {
      return registry.get(id) || null;
    },
    querySelector(selector) {
      if (!selector.startsWith('#')) return null;
      return registry.get(selector.slice(1)) || null;
    },
    addEventListener(type, handler) {
      const handlers = documentListeners.get(type) || new Set();
      handlers.add(handler);
      documentListeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      documentListeners.get(type)?.delete(handler);
    },
    listenerCount(type) {
      return documentListeners.get(type)?.size || 0;
    }
  };

  class MutationObserverImpl {
    constructor(callback) {
      this.callback = callback;
      this.observeCalls = 0;
      this.disconnectCalls = 0;
      observers.push(this);
    }
    observe(target, options) {
      assert.equal(target, list);
      assert.deepEqual(options, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden']
      });
      this.observeCalls += 1;
    }
    disconnect() {
      this.disconnectCalls += 1;
    }
  }

  return { documentRef, MutationObserverImpl, observers, control, input, list, resultButton, registry, preexisting };
}

{
  const harness = createHarness();
  const controller = navigation.createController(harness);
  assert.equal(controller.isMounted(), false);
  assert.equal(controller.mount(), true);
  assert.equal(controller.isMounted(), true);
  assert.equal(controller.mount(), true, 'second mount should be an idempotent success');
  assert.equal(harness.observers.length, 1, 'idempotent mount must not create a second observer');
  assert.equal(harness.observers[0].observeCalls, 1);
  assert.equal(harness.documentRef.listenerCount('keydown'), 1, 'document keydown listener must not duplicate');
  assert.equal(harness.input.listenerCount('input'), 1, 'input listener must not duplicate');

  const ownedNavigation = harness.registry.get(navigation.NAV_ID);
  assert.ok(ownedNavigation, 'controller should create navigation when none exists');
  const previous = ownedNavigation.querySelector('[data-direction="-1"]');
  const next = ownedNavigation.querySelector('[data-direction="1"]');
  assert.equal(previous.listenerCount('click'), 1);
  assert.equal(next.listenerCount('click'), 1);

  assert.equal(controller.destroy(), true);
  assert.equal(controller.isMounted(), false);
  assert.equal(harness.observers[0].disconnectCalls, 1);
  assert.equal(harness.documentRef.listenerCount('keydown'), 0);
  assert.equal(harness.input.listenerCount('input'), 0);
  assert.equal(previous.listenerCount('click'), 0);
  assert.equal(next.listenerCount('click'), 0);
  assert.equal(ownedNavigation.removed, true, 'controller-owned navigation should be removed on destroy');
  assert.equal(controller.destroy(), false, 'destroy should be idempotent after teardown');

  assert.equal(controller.mount(), true, 'clean remount should work after destroy');
  assert.equal(harness.observers.length, 2, 'clean remount may create one fresh observer');
  assert.equal(harness.documentRef.listenerCount('keydown'), 1);
  assert.equal(controller.destroy(), true);
  assert.equal(harness.observers[1].disconnectCalls, 1);
}

{
  const harness = createHarness({ existingNavigation: true });
  const controller = navigation.createController(harness);
  assert.equal(controller.mount(), true);
  assert.equal(controller.destroy(), true);
  assert.equal(harness.preexisting.removed, false, 'pre-existing navigation belongs to the host and must survive teardown');
  assert.equal(harness.registry.get(navigation.NAV_ID), harness.preexisting);
  assert.equal(harness.documentRef.listenerCount('keydown'), 0);
  assert.equal(harness.observers[0].disconnectCalls, 1);
}

{
  const harness = createHarness();
  harness.registry.delete(navigation.LIST_ID);
  const controller = navigation.createController(harness);
  assert.equal(controller.mount(), false, 'missing required surface must fail closed');
  assert.equal(controller.isMounted(), false);
  assert.equal(harness.observers.length, 0);
  assert.equal(harness.documentRef.listenerCount('keydown'), 0);
  assert.equal(controller.destroy(), false);
}

console.log('conversation search navigation lifecycle tests passed');
