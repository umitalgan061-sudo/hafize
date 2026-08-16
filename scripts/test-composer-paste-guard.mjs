import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/composer-paste-guard.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.MAX_COMPOSER_CHARS, 12000);
assert.deepEqual({ ...api.normalizedSelection('abcd', 1, 3) }, { start: 1, end: 3 });
assert.deepEqual({ ...api.normalizedSelection('abcd', 99, -5) }, { start: 0, end: 4 });
assert.equal(api.projectedLength('abcd', 1, 3, 'XYZ'), 5);
assert.equal(api.projectedLength('', 0, 0, 'abc'), 3);
assert.equal(api.projectedLength(null, 0, 0, 'abc'), null);
assert.equal(api.overflowBy('x'.repeat(11999), 11999, 11999, 'a'), 0);
assert.equal(api.overflowBy('x'.repeat(11999), 11999, 11999, 'ab'), 1);
assert.equal(api.overflowBy('x'.repeat(12000), 0, 100, 'y'.repeat(100)), 0);
assert.equal(api.overflowBy('abc', 0, 0, 'x', 0), null);

function node() {
  const listeners = new Map();
  const attrs = new Map();
  return {
    value: '', selectionStart: 0, selectionEnd: 0, hidden: false, textContent: '', dataset: {}, parentNode: null,
    focused: 0, removed: false,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    listener(type) { return listeners.get(type); },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    getAttribute(name) { return attrs.get(name); },
    append(child) { child.parentNode = this; },
    focus() { this.focused += 1; },
    remove() { this.removed = true; }
  };
}

const parent = node();
const composer = node();
composer.parentNode = parent;
composer.value = 'x'.repeat(11999);
composer.selectionStart = composer.value.length;
composer.selectionEnd = composer.value.length;
const map = new Map([['messageInput', composer]]);
const documentRef = {
  querySelector(selector) { return selector.startsWith('#') ? map.get(selector.slice(1)) || null : null; },
  createElement() { return node(); }
};
parent.append = (child) => { child.parentNode = parent; if (child.id) map.set(child.id, child); };
const pending = new Map();
let timerId = 0;
const controller = api.createController({
  documentRef,
  setTimeoutImpl(fn) { timerId += 1; pending.set(timerId, fn); return timerId; },
  clearTimeoutImpl(id) { pending.delete(id); }
});
assert.equal(controller.mount(), true);
assert.equal(controller.mount(), true);

const allowed = { defaultPrevented: false, clipboardData: { getData() { return 'a'; } }, preventDefault() { this.defaultPrevented = true; } };
assert.equal(controller.onPaste(allowed), false);
assert.equal(allowed.defaultPrevented, false);

const blocked = { defaultPrevented: false, clipboardData: { getData() { return 'ab'; } }, preventDefault() { this.defaultPrevented = true; } };
assert.equal(controller.onPaste(blocked), true);
assert.equal(blocked.defaultPrevented, true);
assert.equal(composer.value.length, 11999);
assert.equal(composer.focused, 1);
assert.equal(controller.snapshot().statusVisible, true);
controller.clearStatus();
assert.equal(controller.snapshot().statusVisible, false);
controller.destroy();
assert.equal(controller.snapshot().mounted, false);

assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('XMLHttpRequest'));
assert.ok(!source.includes('WebSocket'));
assert.ok(!source.includes('sendBeacon'));
assert.ok(!source.includes('localStorage'));
assert.ok(!source.includes('sessionStorage'));
assert.ok(!source.includes('requestSubmit'));
assert.ok(!source.includes('navigator.clipboard'));

console.log('composer paste guard contract ok');
