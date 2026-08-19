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
const previous = target({ dataset: { direction: '-1' } });
const next = target({ dataset: { direction: '1' } });
const status = { textContent: '' };
const navNode = {
  contains(value) { return value === previous || value === next; },
  querySelector(selector) {
    if (selector === '[data-direction="-1"]') return previous;
    if (selector === '[data-direction="1"]') return next;
    if (selector === `#${nav.STATUS_ID}`) return status;
    return null;
  },
  remove() {}
};
const documentEvents = target();
const documentRef = {
  ...documentEvents,
  head: { append() {} },
  getElementById(id) { return id === nav.NAV_ID ? navNode : null; },
  querySelector(selector) {
    if (selector === `#${nav.CONTROL_ID}`) return { append() {} };
    if (selector === `#${nav.INPUT_ID}`) return input;
    if (selector === `#${nav.LIST_ID}`) return { querySelectorAll: () => rows };
    return null;
  },
  createElement() { throw new Error('unexpected element creation'); }
};

const controller = nav.createController({ documentRef, rootRef: {}, MutationObserverImpl: null });
assert.equal(controller.mount(), true);

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
