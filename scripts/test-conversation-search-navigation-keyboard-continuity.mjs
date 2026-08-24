import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nav = require('../public/conversation-search-navigation.js');

function target(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    dispatch(type, event) { listeners.get(type)?.(event); },
    listeners
  };
}

function element(tag = 'div') {
  const children = [];
  return target({
    tagName: tag.toUpperCase(),
    dataset: {},
    id: '',
    textContent: '',
    disabled: false,
    append(...nodes) { children.push(...nodes); },
    setAttribute(name, value) {
      if (name === 'data-direction') this.dataset.direction = String(value);
    },
    contains(value) { return value === this || children.includes(value); },
    querySelector(selector) {
      if (selector === '[data-direction="-1"]') return children.find((child) => child.dataset?.direction === '-1') || null;
      if (selector === '[data-direction="1"]') return children.find((child) => child.dataset?.direction === '1') || null;
      if (selector === `#${nav.STATUS_ID}`) return children.find((child) => child.id === nav.STATUS_ID) || null;
      return null;
    },
    remove() {}
  });
}

const focused = [];
const buttons = Array.from({ length: 4 }, (_, index) => ({
  id: `conversation-${index}`,
  focus() { focused.push(index); }
}));
const rows = buttons.map((button) => ({
  hidden: false,
  querySelector(selector) { return selector === '.conversation-open' ? button : null; }
}));
const input = target({ value: 'ankara' });
const list = { querySelectorAll: () => rows };
const control = { append(node) { navNode = node; } };
let navNode = null;
const documentEvents = target();
const documentRef = {
  ...documentEvents,
  head: { append() {} },
  getElementById(id) { return id === nav.NAV_ID ? navNode : null; },
  querySelector(selector) {
    if (selector === `#${nav.CONTROL_ID}`) return control;
    if (selector === `#${nav.INPUT_ID}`) return input;
    if (selector === `#${nav.LIST_ID}`) return list;
    return null;
  },
  createElement: (tag) => element(tag)
};

const controller = nav.createController({ documentRef, MutationObserverImpl: null });
assert.equal(controller.mount(), true);
assert.ok(navNode, 'controller must create and own navigation');
const previous = navNode.querySelector('[data-direction="-1"]');
const status = navNode.querySelector(`#${nav.STATUS_ID}`);

function key(targetRef, keyName, extra = {}) {
  let prevented = false;
  documentRef.dispatch('keydown', {
    target: targetRef,
    key: keyName,
    altKey: true,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    preventDefault() { prevented = true; },
    ...extra
  });
  return prevented;
}

assert.equal(key(input, 'ArrowDown'), true);
assert.equal(key(buttons[0], 'ArrowDown'), true);
assert.equal(key(buttons[1], 'ArrowDown'), true);
assert.equal(key(buttons[2], 'ArrowDown'), true);
assert.equal(key(buttons[3], 'ArrowDown'), true);
assert.deepEqual(focused, [0, 1, 2, 3, 0]);
assert.equal(status.textContent, '1 / 4');

assert.equal(key(buttons[0], 'ArrowUp'), true);
assert.deepEqual(focused, [0, 1, 2, 3, 0, 3]);
assert.equal(status.textContent, '4 / 4');

assert.equal(key(previous, 'ArrowUp'), true);
assert.deepEqual(focused, [0, 1, 2, 3, 0, 3, 2]);

const outside = { id: 'composer' };
assert.equal(key(outside, 'ArrowDown'), false);
assert.deepEqual(focused, [0, 1, 2, 3, 0, 3, 2]);

assert.equal(key(buttons[2], 'ArrowDown', { ctrlKey: true }), false);
assert.equal(key(buttons[2], 'ArrowDown', { metaKey: true }), false);
assert.equal(key(buttons[2], 'ArrowDown', { shiftKey: true }), false);
assert.equal(key(buttons[2], 'ArrowDown', { repeat: true }), false);
assert.equal(key(buttons[2], 'Enter'), false);

rows[1].hidden = true;
controller.reset();
assert.equal(key(input, 'ArrowDown'), true);
assert.equal(focused.at(-1), 0);
assert.equal(key(buttons[0], 'ArrowDown'), true);
assert.equal(focused.at(-1), 2);

input.value = '   ';
controller.reset();
assert.equal(key(buttons[2], 'ArrowDown'), false);

controller.destroy();
assert.equal(documentRef.listeners.size, 0);

console.log('conversation search keyboard continuity tests passed');
