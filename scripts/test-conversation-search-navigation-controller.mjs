import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nav = require('../public/conversation-search-navigation.js');

function eventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    fire(type, event = {}) { listeners.get(type)?.(event); },
    listenerCount: () => listeners.size
  };
}

const focusLog = [];
const rows = [0, 1, 2].map((index) => ({
  hidden: false,
  querySelector(selector) {
    return selector === '.conversation-open'
      ? { focus: () => focusLog.push(index) }
      : null;
  }
}));
const input = eventTarget({ value: 'hedef' });
const previous = eventTarget({ dataset: { direction: '-1' }, disabled: false });
const next = eventTarget({ dataset: { direction: '1' }, disabled: false });
const status = { textContent: '' };
const navNode = {
  removed: false,
  querySelector(selector) {
    if (selector === '[data-direction="-1"]') return previous;
    if (selector === '[data-direction="1"]') return next;
    if (selector === `#${nav.STATUS_ID}`) return status;
    return null;
  },
  remove() { this.removed = true; }
};
const control = { append() {} };
const list = { querySelectorAll: () => rows };
const head = { append() {} };
const documentRef = {
  head,
  getElementById(id) { return id === nav.NAV_ID ? navNode : null; },
  querySelector(selector) {
    if (selector === `#${nav.CONTROL_ID}`) return control;
    if (selector === `#${nav.INPUT_ID}`) return input;
    if (selector === `#${nav.LIST_ID}`) return list;
    return null;
  },
  createElement() { throw new Error('existing nav should be reused'); }
};
class Observer {
  constructor(fn) { this.fn = fn; }
  observe() {}
  disconnect() { this.disconnected = true; }
}

const controller = nav.createController({ documentRef, rootRef: {}, MutationObserverImpl: Observer });
assert.equal(controller.mount(), true);
assert.equal(status.textContent, '3 eşleşme');

let prevented = 0;
input.fire('keydown', {
  altKey: true,
  key: 'ArrowDown',
  preventDefault: () => { prevented += 1; }
});
assert.deepEqual(focusLog, [0]);
assert.equal(status.textContent, '1 / 3');
assert.equal(prevented, 1);

input.fire('keydown', { altKey: true, key: 'ArrowUp', preventDefault: () => { prevented += 1; } });
assert.deepEqual(focusLog, [0, 2]);
assert.equal(status.textContent, '3 / 3');

next.fire('click', { currentTarget: next, preventDefault() {} });
assert.deepEqual(focusLog, [0, 2, 0]);

input.fire('keydown', { altKey: false, key: 'ArrowDown', preventDefault: () => { throw new Error('plain arrow hijacked'); } });
assert.deepEqual(focusLog, [0, 2, 0]);

input.value = '';
input.fire('input');
assert.equal(previous.disabled, true);
assert.equal(next.disabled, true);
assert.equal(status.textContent, '');

controller.destroy();
assert.equal(navNode.removed, true);
assert.equal(input.listenerCount(), 0);
assert.equal(previous.listenerCount(), 0);
assert.equal(next.listenerCount(), 0);

console.log('conversation search navigation controller tests passed');
