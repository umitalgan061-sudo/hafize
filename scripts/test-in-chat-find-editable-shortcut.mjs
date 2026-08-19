import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const find = require('../public/in-chat-find.js');

function eventTarget(initial = {}) {
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
    emit(type, event) {
      for (const handler of [...(listeners.get(type) || [])]) handler(event);
    }
  };
}

function element(tagName, overrides = {}) {
  return eventTarget({
    tagName: tagName.toUpperCase(),
    hidden: false,
    disabled: false,
    value: '',
    textContent: '',
    children: [],
    attributes: new Map(),
    classList: { contains() { return false; }, add() {}, remove() {} },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; },
    focus() { this.focused = true; },
    select() { this.selected = true; },
    append(...children) { this.children.push(...children); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    remove() {},
    ...overrides
  });
}

function createHarness() {
  const input = element('input');
  const status = element('span');
  status.className = 'in-chat-find-status';
  const previous = element('button');
  const next = element('button');
  const close = element('button');
  const control = element('div', {
    id: find.CONTROL_ID,
    hidden: true,
    querySelector(selector) {
      if (selector === 'input') return input;
      if (selector === '.in-chat-find-status') return status;
      return null;
    },
    querySelectorAll(selector) {
      return selector === 'button' ? [previous, next, close] : [];
    }
  });
  const trigger = element('button', { id: find.TRIGGER_ID });
  const messages = element('section', {
    id: 'messages',
    querySelectorAll(selector) { return selector === '.message' ? [] : []; }
  });
  const historyHead = element('div');
  const body = element('body');
  const head = element('head');
  const documentRef = eventTarget({
    head,
    body,
    activeElement: null,
    querySelector(selector) {
      if (selector === '#messages') return messages;
      if (selector === '.history-head') return historyHead;
      if (selector === `#${find.TRIGGER_ID}`) return trigger;
      if (selector === `#${find.CONTROL_ID}`) return control;
      return null;
    },
    createElement(tagName) { return element(tagName); }
  });
  const controller = find.createController({ documentRef, MutationObserverImpl: null });
  assert.equal(controller.mount(), true);
  return { controller, documentRef, control, input };
}

function keyEvent(target, overrides = {}) {
  let prevented = 0;
  return {
    key: 'f',
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    isComposing: false,
    target,
    preventDefault() { prevented += 1; },
    prevented: () => prevented,
    ...overrides
  };
}

{
  const { controller, documentRef, control } = createHarness();
  const target = element('button');
  const event = keyEvent(target);
  documentRef.emit('keydown', event);
  assert.equal(event.prevented(), 1, 'Ctrl+F on non-editable chat chrome should be intercepted');
  assert.equal(control.hidden, false, 'Hafize in-chat find should open');
  controller.destroy();
}

for (const tagName of ['input', 'textarea']) {
  const { controller, documentRef, control } = createHarness();
  const event = keyEvent(element(tagName));
  documentRef.emit('keydown', event);
  assert.equal(event.prevented(), 0, `${tagName} must retain native browser Find`);
  assert.equal(control.hidden, true);
  controller.destroy();
}

{
  const { controller, documentRef, control } = createHarness();
  const editable = element('div');
  editable.setAttribute('contenteditable', 'plaintext-only');
  const nested = element('span', { parentElement: editable });
  const event = keyEvent(nested, { ctrlKey: false, metaKey: true });
  documentRef.emit('keydown', event);
  assert.equal(event.prevented(), 0, 'Cmd+F inside inherited contenteditable must remain native');
  assert.equal(control.hidden, true);
  controller.destroy();
}

{
  const { controller, documentRef, control } = createHarness();
  const editable = element('div');
  editable.setAttribute('contenteditable', 'true');
  const island = element('span', { parentElement: editable });
  island.setAttribute('contenteditable', 'false');
  const event = keyEvent(island);
  documentRef.emit('keydown', event);
  assert.equal(event.prevented(), 1, 'contenteditable=false island is an explicit non-editable boundary');
  assert.equal(control.hidden, false);
  controller.destroy();
}

{
  const { controller, documentRef, control } = createHarness();
  const event = keyEvent(element('div'), { isComposing: true });
  documentRef.emit('keydown', event);
  assert.equal(event.prevented(), 0, 'IME composition must not be interrupted by app find');
  assert.equal(control.hidden, true);
  controller.destroy();
}

console.log('in-chat find editable shortcut tests passed');
