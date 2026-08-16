import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/composer-history.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

assert.equal(api.normalizeMessage(null), null);
assert.equal(api.normalizeMessage(''), null);
assert.equal(api.normalizeMessage('   '), null);
assert.equal(api.normalizeMessage('a\r\nb\rc\u0000'), 'a\nb\nc');
assert.equal(api.normalizeMessage('x'.repeat(api.MAX_MESSAGE_CHARS + 1)), null);
assert.equal(api.normalizeMessage('x'.repeat(api.MAX_MESSAGE_CHARS)).length, api.MAX_MESSAGE_CHARS);

function article(text) {
  return { querySelector(selector) { return selector === '.content' ? { textContent: text } : null; } };
}
const root = { querySelectorAll(selector) {
  assert.equal(selector, '.message.user');
  return [article('ilk'), article('ikinci\r\nsatır'), article(''), article('son')];
}};
assert.deepEqual(Array.from(api.collectHistory(root)), ['ilk', 'ikinci\nsatır', 'son']);

const many = Array.from({ length: api.MAX_HISTORY + 7 }, (_, i) => article(`m${i}`));
const bounded = api.collectHistory({ querySelectorAll() { return many; } });
assert.equal(bounded.length, api.MAX_HISTORY);
assert.equal(bounded[0], 'm7');
assert.equal(bounded.at(-1), `m${api.MAX_HISTORY + 6}`);
assert.equal(Object.isFrozen(bounded), true);

assert.equal(api.collapsedSelection({ selectionStart: 0, selectionEnd: 0 }), 0);
assert.equal(api.collapsedSelection({ selectionStart: 1, selectionEnd: 2 }), null);
assert.equal(api.collapsedSelection({ selectionStart: null, selectionEnd: null }), null);

function key(key, extra = {}) {
  return { key, defaultPrevented: false, repeat: false, isComposing: false, ...extra };
}
const input = { value: 'taslak', selectionStart: 0, selectionEnd: 0, disabled: false, readOnly: false };
assert.equal(api.canRecall(key('ArrowUp'), input, -1), true);
assert.equal(api.canRecall(key('ArrowDown'), input, 1), false);
input.selectionStart = input.selectionEnd = input.value.length;
assert.equal(api.canRecall(key('ArrowDown'), input, 1), true);
assert.equal(api.canRecall(key('ArrowUp'), input, -1), false);
for (const variant of [
  { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
  { repeat: true }, { isComposing: true }, { defaultPrevented: true }
]) {
  assert.equal(api.canRecall(key('ArrowDown', variant), input, 1), false);
}
assert.equal(api.canRecall(key('Enter'), input, 1), false);
assert.equal(api.canRecall(key('ArrowDown'), input, 0), false);

for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'localStorage', 'sessionStorage',
  'navigator.clipboard', 'requestSubmit', '.submit(', 'innerHTML', 'eval('
]) assert.equal(source.includes(forbidden), false, `forbidden API: ${forbidden}`);

assert.match(source, /\.message\.user/);
assert.doesNotMatch(source, /\.message\.assistant/);
assert.match(source, /MAX_HISTORY = 50/);
assert.match(source, /MAX_MESSAGE_CHARS = 12_000/);
console.log('composer history core contract ok');
