import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/composer-history.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.deepEqual(Array.from(api.collectHistory(null)), []);
assert.deepEqual(Array.from(api.collectHistory({})), []);
const malformed = [
  null, {}, { querySelector() { return null; } },
  { querySelector() { return { textContent: null }; } },
  { querySelector() { return { textContent: 'x'.repeat(api.MAX_MESSAGE_CHARS + 1) }; } },
  { querySelector() { return { textContent: '\u0000ok' }; } }
];
assert.deepEqual(Array.from(api.collectHistory({ querySelectorAll() { return malformed; } })), ['ok']);
assert.equal(api.normalizeMessage('\u0000\u0000'), null);
assert.equal(api.normalizeMessage(' \r\n '), null);
assert.equal(api.normalizeMessage('  içerik  '), '  içerik  ');

const base = {
  defaultPrevented: false, repeat: false, isComposing: false,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false
};
const start = { value: 'abc', selectionStart: 0, selectionEnd: 0, disabled: false, readOnly: false };
const end = { ...start, selectionStart: 3, selectionEnd: 3 };
assert.equal(api.canRecall({ ...base, key: 'ArrowUp' }, start, -1), true);
assert.equal(api.canRecall({ ...base, key: 'ArrowDown' }, end, 1), true);
assert.equal(api.canRecall({ ...base, key: 'ArrowDown' }, start, 1), false);
assert.equal(api.canRecall({ ...base, key: 'ArrowUp' }, end, -1), false);
assert.equal(api.canRecall({ ...base, key: 'ArrowUp' }, { ...start, disabled: true }, -1), false);
assert.equal(api.canRecall({ ...base, key: 'ArrowUp' }, { ...start, readOnly: true }, -1), false);
assert.equal(api.canRecall({ ...base, key: 'ArrowUp' }, { ...start, selectionEnd: 1 }, -1), false);

assert.throws(() => api.createController({ documentRef: null }), /INVALID_COMPOSER_HISTORY_DOCUMENT/);
assert.equal(api.mount({ documentRef: null }), null);
const incomplete = api.createController({ documentRef: { querySelector() { return null; } } });
assert.equal(incomplete.mount(), false);
assert.equal(incomplete.snapshot().mounted, false);

const emptyInput = {
  value: '', selectionStart: 0, selectionEnd: 0, disabled: false, readOnly: false,
  addEventListener() {}, removeEventListener() {}, focus() {}, setSelectionRange() {}, dispatchEvent() {}
};
const emptyStatus = { hidden: true, textContent: '', setAttribute() {}, remove() {} };
const emptyController = api.createController({
  EventImpl: class { constructor(type) { this.type = type; } },
  documentRef: {
    querySelector(selector) {
      if (selector === '#messageInput') return emptyInput;
      if (selector === '#messages') return { querySelectorAll() { return []; }, addEventListener() {}, removeEventListener() {} };
      if (selector === '#composer') return { append() {} };
      return null;
    },
    createElement() { return emptyStatus; }
  }
});
assert.equal(emptyController.mount(), true);
assert.equal(emptyController.recall(-1), false);
assert.match(emptyStatus.textContent, /geri çağrılacak/);
assert.equal(emptyInput.value, '');
emptyController.destroy();

console.log('composer history edge cases ok');
