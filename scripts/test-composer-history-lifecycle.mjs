import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/composer-history.js', import.meta.url), 'utf8');
const module = { exports: {} };
class FakeEvent { constructor(type, init = {}) { this.type = type; Object.assign(this, init); } }
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

function emitter(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); return true; },
    emit(type, event = {}) { for (const fn of listeners.get(type) || []) fn(event); },
    count(type) { return listeners.get(type)?.size || 0; }
  };
}

const rows = ['bir', 'iki', 'üç'].map((text) => ({ querySelector() { return { textContent: text }; } }));
let range = null;
let focusCount = 0;
const input = emitter({
  value: 'korunan taslak', selectionStart: 0, selectionEnd: 0, disabled: false, readOnly: false,
  focus() { focusCount += 1; },
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; range = [start, end]; }
});
const messages = emitter({ querySelectorAll() { return rows; } });
const status = {
  hidden: true, textContent: '', attrs: new Map(),
  setAttribute(name, value) { this.attrs.set(name, value); },
  remove() { this.removed = true; }
};
const composer = { append(node) { this.child = node; } };
const documentRef = {
  querySelector(selector) {
    if (selector === '#messageInput') return input;
    if (selector === '#messages') return messages;
    if (selector === '#composer') return composer;
    return null;
  },
  createElement(tag) { assert.equal(tag, 'p'); return status; }
};
const controller = api.createController({ documentRef, EventImpl: FakeEvent });
assert.equal(controller.mount(), true);
assert.equal(controller.mount(), true);
assert.equal(input.count('keydown'), 1);
assert.equal(input.count('input'), 1);
assert.equal(controller.snapshot().historyLength, 3);
assert.equal(status.attrs.get('role'), 'status');
assert.equal(status.attrs.get('aria-live'), 'polite');

function nav(key) {
  let prevented = 0;
  input.emit('keydown', {
    key, defaultPrevented: false, repeat: false, isComposing: false,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    preventDefault() { prevented += 1; }
  });
  return prevented;
}

assert.equal(nav('ArrowUp'), 1);
assert.equal(input.value, 'üç');
assert.deepEqual(range, [2, 2]);
assert.match(status.textContent, /3\/3/);
assert.equal(nav('ArrowUp'), 1);
assert.equal(input.value, 'iki');
assert.equal(nav('ArrowUp'), 1);
assert.equal(input.value, 'bir');
assert.equal(nav('ArrowUp'), 1);
assert.equal(input.value, 'bir');
assert.match(status.textContent, /En eski/);

assert.equal(nav('ArrowDown'), 1);
assert.equal(input.value, 'iki');
assert.equal(nav('ArrowDown'), 1);
assert.equal(input.value, 'üç');
assert.equal(nav('ArrowDown'), 1);
assert.equal(input.value, 'korunan taslak');
assert.equal(controller.snapshot().navigating, false);
assert.match(status.textContent, /taslağa/);
assert.ok(focusCount >= 6);

input.selectionStart = input.selectionEnd = 0;
assert.equal(nav('ArrowUp'), 1);
assert.equal(controller.snapshot().navigating, true);
assert.equal(nav('ArrowLeft'), 0);
assert.equal(controller.snapshot().navigating, false);
assert.equal(status.hidden, true);

input.value = 'manuel';
input.emit('input', new FakeEvent('input'));
assert.equal(controller.snapshot().navigating, false);
assert.equal(status.hidden, true);

assert.equal(controller.destroy(), true);
assert.equal(controller.destroy(), false);
assert.equal(input.count('keydown'), 0);
assert.equal(input.count('input'), 0);
assert.equal(status.removed, true);
console.log('composer history lifecycle ok');
