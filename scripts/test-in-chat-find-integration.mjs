import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const finderApi = require('../public/in-chat-find.js');
const keyboardApi = require('../public/keyboard-shortcuts.js');
const shortcutHelpApi = require('../public/shortcut-help.js');

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    contains: (value) => values.has(value),
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    has: (value) => values.has(value)
  };
}

function message(text) {
  const classList = makeClassList(['message']);
  return {
    classList,
    scrollCalls: [],
    querySelector(selector) {
      return selector === '.content' ? { textContent: text } : null;
    },
    scrollIntoView(options) {
      this.scrollCalls.push(options);
    }
  };
}

function element(tag = 'div') {
  const listeners = new Map();
  const attrs = new Map();
  const children = [];
  return {
    tagName: tag.toUpperCase(),
    id: '',
    type: '',
    className: '',
    hidden: false,
    disabled: false,
    textContent: '',
    value: '',
    maxLength: 0,
    autocomplete: '',
    spellcheck: false,
    children,
    focused: false,
    selected: false,
    classList: makeClassList(),
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); },
    append(...nodes) { children.push(...nodes); },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    emit(type, event = {}) { return listeners.get(type)?.({ target: this, ...event }); },
    focus() { this.focused = true; },
    select() { this.selected = true; },
    remove() { this.removed = true; },
    querySelector(selector) {
      if (selector === 'input') return children.find((child) => child.tagName === 'INPUT') || null;
      if (selector === '.in-chat-find-status') return children.find((child) => child.className === 'in-chat-find-status') || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button') return children.filter((child) => child.tagName === 'BUTTON');
      return [];
    }
  };
}

const first = message('Birinci eşleşme var');
const second = message('İkinci eşleşme var');
const third = message('Burada yok');
const messages = element();
messages.querySelectorAll = (selector) => selector === '.message' ? [first, second, third] : [];
const historyHead = element();
const body = element('body');
const head = element('head');
const documentListeners = new Map();
let activeElement = null;
const nodesById = new Map();

const documentRef = {
  body,
  head,
  get activeElement() { return activeElement; },
  set activeElement(value) { activeElement = value; },
  querySelector(selector) {
    if (selector === '#messages') return messages;
    if (selector === '.history-head') return historyHead;
    if (selector.startsWith('#')) return nodesById.get(selector.slice(1)) || null;
    return null;
  },
  createElement(tag) {
    const node = element(tag);
    const originalSet = node.setAttribute;
    node.setAttribute = (name, value) => originalSet.call(node, name, value);
    return node;
  },
  addEventListener(type, fn) { documentListeners.set(type, fn); },
  removeEventListener(type) { documentListeners.delete(type); }
};

const originalHistoryAppend = historyHead.append;
historyHead.append = (...items) => {
  originalHistoryAppend(...items);
  for (const item of items) if (item.id) nodesById.set(item.id, item);
};
const originalBodyAppend = body.append;
body.append = (...items) => {
  originalBodyAppend(...items);
  for (const item of items) if (item.id) nodesById.set(item.id, item);
};

const controller = finderApi.createController({ documentRef, MutationObserverImpl: null });
assert.equal(controller.mount(), true);
const trigger = historyHead.children.find((node) => node.id === finderApi.TRIGGER_ID);
const control = body.children.find((node) => node.id === finderApi.CONTROL_ID);
assert.ok(trigger, 'visible trigger mounted');
assert.ok(control, 'search panel mounted');
assert.equal(control.hidden, true);
assert.equal(trigger.getAttribute('aria-expanded'), 'false');

activeElement = trigger;
trigger.emit('click');
assert.equal(control.hidden, false);
assert.equal(trigger.getAttribute('aria-expanded'), 'true');
const input = control.querySelector('input');
assert.equal(input.focused, true);
input.value = 'eşleşme';
input.emit('input');
assert.equal(first.classList.has(finderApi.ACTIVE_CLASS), true);
assert.equal(second.classList.has(finderApi.ACTIVE_CLASS), true);
assert.equal(third.classList.has(finderApi.ACTIVE_CLASS), false);
assert.equal(first.classList.has(finderApi.CURRENT_CLASS), true);

assert.equal(controller.step(1), true);
assert.equal(second.classList.has(finderApi.CURRENT_CLASS), true);
assert.deepEqual(second.scrollCalls.at(-1), { block: 'center', behavior: 'smooth' });
assert.equal(controller.step(1), true, 'matching navigation wraps');
assert.equal(first.classList.has(finderApi.CURRENT_CLASS), true);

assert.equal(controller.dismiss(), true);
assert.equal(control.hidden, true);
assert.equal(trigger.getAttribute('aria-expanded'), 'false');
assert.equal(first.classList.has(finderApi.ACTIVE_CLASS), false);
assert.equal(trigger.focused, true);

let prevented = false;
const keyboardDocument = {
  addEventListener() {}, removeEventListener() {},
  querySelector() { return null; }
};
const keyboardController = keyboardApi.createController({ documentRef: keyboardDocument });
assert.equal(keyboardController.handleKeydown({ key: 'f', ctrlKey: true, preventDefault() { prevented = true; } }), false);
assert.equal(prevented, false, 'legacy keyboard controller leaves Ctrl+F to finder');

assert.equal(shortcutHelpApi.SHORTCUTS.some(([keys, label]) => keys === 'Ctrl/⌘ + F' && label === 'Aktif sohbette ara'), true);

const source = fs.readFileSync(path.resolve('public/in-chat-find.js'), 'utf8');
assert.match(source, /history-head/);
assert.match(source, /Aktif sohbet mesajlarında ara/);
assert.match(source, /aria-expanded/);
assert.match(source, /characterData: true/);
assert.equal(source.includes('windowRef'), false);

controller.destroy();
assert.equal(documentListeners.has('keydown'), false);
assert.equal(trigger.removed, true);
assert.equal(control.removed, true);
console.log('in-chat find integration tests passed');
