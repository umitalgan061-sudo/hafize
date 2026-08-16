import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/composer-paste-guard.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.overflowBy('abc', Number.NaN, Number.NaN, 'x'), 0);
assert.equal(api.overflowBy('abc', 3, 1, 'x'), 0);
assert.equal(api.overflowBy('x'.repeat(12000), 0, 12000, 'y'.repeat(12000)), 0);
assert.equal(api.overflowBy('x'.repeat(12000), 0, 0, ''), 0);
assert.equal(api.overflowBy('abc', 0, 0, null), null);

function minimalDocument(input) {
  const status = { hidden: true, dataset: {}, textContent: '', setAttribute() {}, remove() {} };
  return {
    querySelector(selector) {
      if (selector === '#messageInput') return input;
      if (selector === '#hafizeComposerPasteStatus') return null;
      return null;
    },
    createElement() { return status; }
  };
}

const input = {
  value: 'abc', selectionStart: 3, selectionEnd: 3,
  parentNode: { append() {} },
  addEventListener() {}, removeEventListener() {}, focus() {}
};
const controller = api.createController({ documentRef: minimalDocument(input), setTimeoutImpl() { return 1; }, clearTimeoutImpl() {} });
assert.equal(controller.mount(), true);
assert.equal(controller.onPaste(null), false);
assert.equal(controller.onPaste({ defaultPrevented: true }), false);
assert.equal(controller.onPaste({ defaultPrevented: false }), false);
assert.equal(controller.onPaste({ defaultPrevented: false, clipboardData: {} }), false);
assert.equal(controller.onPaste({ defaultPrevented: false, clipboardData: { getData() { return ''; } } }), false);
controller.destroy();

assert.throws(() => api.createController({ documentRef: {} }), /INVALID_COMPOSER_PASTE_DOCUMENT/);
assert.throws(() => api.createController({ documentRef: { querySelector() {}, createElement() {} }, setTimeoutImpl: null, clearTimeoutImpl() {} }), /INVALID_COMPOSER_PASTE_TIMER/);

console.log('composer paste guard edge cases ok');
