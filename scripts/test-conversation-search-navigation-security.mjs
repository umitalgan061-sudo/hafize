import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nav = require('../public/conversation-search-navigation.js');

const source = String.raw`${nav.createController}`;
assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/i);
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|clipboard/i);
assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML/i);
assert.doesNotMatch(source, /requestSubmit|\.submit\s*\(|\.click\s*\(/i);
assert.doesNotMatch(source, /shell=True|child_process|exec\s*\(|spawn\s*\(/i);

const fakeInput = { value: 'hedef' };
const rowA = { hidden: false, querySelector: () => ({ focus() {} }) };
const rowB = { hidden: true, querySelector: () => ({ focus() { throw new Error('hidden row focused'); } }) };
const rowC = { hidden: false, querySelector: () => null };
const list = { querySelectorAll: () => [rowA, rowB, rowC] };
assert.equal(nav.hasQuery(fakeInput), true);
assert.equal(nav.visibleTargets(list).length, 1);

for (const bad of [NaN, Infinity, -Infinity, 0.5]) {
  assert.equal(nav.nextIndex(0, bad, 1), -1);
}
assert.equal(nav.nextIndex(999, 2, 1), 0);
assert.equal(nav.nextIndex(999, 2, -1), 1);

console.log('conversation search navigation security tests passed');
