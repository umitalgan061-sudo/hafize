import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/message-keyboard-nav.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {}, Array, Object, String, Boolean });
const api = module.exports;

function article(id, sender) {
  const attributes = new Map();
  const node = {
    hidden: false,
    tabIndex: -1,
    dataset: { messageId: id },
    tagName: 'ARTICLE',
    focused: 0,
    scrolled: 0,
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    querySelector(selector) {
      if (selector === '.meta') return { textContent: sender };
      return null;
    },
    closest(selector) {
      return selector === '.message[data-message-id]' ? node : null;
    },
    focus(options) {
      node.focused += 1;
      node.focusOptions = options;
    },
    scrollIntoView(options) {
      node.scrolled += 1;
      node.scrollOptions = options;
    }
  };
  return node;
}

const first = article('m1', 'Sen');
const second = article('m2', 'Hafize');
const third = article('m3', 'Sen');
const listeners = new Map();
const container = {
  querySelectorAll(selector) {
    return selector === '.message[data-message-id]' ? [first, second, third] : [];
  },
  addEventListener(type, fn) { listeners.set(type, fn); },
  removeEventListener(type) { listeners.delete(type); }
};

const styleNodes = [];
const documentRef = {
  head: { append(node) { styleNodes.push(node); } },
  querySelector(selector) {
    if (selector === '#messages') return container;
    if (selector === '#hafize-message-keyboard-nav-style') return styleNodes.find((node) => node.id === 'hafize-message-keyboard-nav-style') || null;
    return null;
  },
  createElement(tag) {
    return { tagName: tag.toUpperCase(), id: '', textContent: '' };
  }
};

let observed = null;
let disconnected = 0;
class Observer {
  constructor(callback) { this.callback = callback; }
  observe(target, options) { observed = { target, options }; }
  disconnect() { disconnected += 1; }
}

const controller = api.createController({ documentRef, MutationObserverImpl: Observer });
assert.equal(controller.mount(), true);
assert.equal(styleNodes.length, 1);
assert.equal(first.tabIndex, 0);
assert.equal(second.tabIndex, -1);
assert.equal(third.tabIndex, -1);
assert.equal(first.dataset.hafizeMessageNav, '1');
assert.equal(first.getAttribute('aria-label'), 'Sen mesajı');
assert.equal(second.getAttribute('aria-label'), 'Hafize mesajı');
assert.equal(observed.target, container);
assert.equal(observed.options.childList, true);
assert.equal(listeners.has('keydown'), true);
assert.equal(listeners.has('focusin'), true);

const down = {
  key: 'ArrowDown',
  target: first,
  defaultPrevented: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  prevented: 0,
  preventDefault() { this.prevented += 1; }
};
assert.equal(controller.onKeyDown(down), true);
assert.equal(down.prevented, 1);
assert.equal(first.tabIndex, -1);
assert.equal(second.tabIndex, 0);
assert.equal(second.focused, 1);
assert.equal(second.scrolled, 1);
assert.equal(second.focusOptions.preventScroll, true);
assert.equal(second.scrollOptions.block, 'nearest');
assert.equal(second.scrollOptions.inline, 'nearest');

const end = { ...down, key: 'End', target: second, prevented: 0 };
assert.equal(controller.onKeyDown(end), true);
assert.equal(third.tabIndex, 0);
assert.equal(third.focused, 1);

const interactive = {
  ...down,
  key: 'ArrowUp',
  target: { tagName: 'BUTTON', closest() { return first; } },
  prevented: 0
};
assert.equal(controller.onKeyDown(interactive), false);
assert.equal(interactive.prevented, 0);

assert.equal(controller.onFocusIn({ target: first }), true);
assert.equal(first.tabIndex, 0);
assert.ok(first.focused >= 1);

controller.destroy();
assert.equal(disconnected, 1);
assert.equal(listeners.size, 0);
assert.equal(first.dataset.hafizeMessageNav, undefined);
assert.equal(first.getAttribute('tabindex'), null);

console.log('message keyboard navigation lifecycle tests passed');
