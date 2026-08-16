import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/message-timeline.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {}, Date, Intl, Map, JSON });
const api = module.exports;

assert.equal(api.readMessageTimes('').size, 0);
assert.equal(api.readMessageTimes('null').size, 0);
assert.equal(api.readMessageTimes('42').size, 0);
assert.equal(api.normalizeIso('2026-08-16'), null);
assert.equal(api.normalizeIso('x'.repeat(65)), null);

const duplicate = JSON.stringify([
  { messages: [{ id: 'same', at: '2026-08-16T10:00:00Z' }] },
  { messages: [{ id: 'same', at: '2026-08-17T10:00:00Z' }] }
]);
assert.equal(api.readMessageTimes(duplicate).get('same'), '2026-08-16T10:00:00.000Z');

const mixed = JSON.stringify([
  null,
  {},
  { messages: null },
  { messages: [null, {}, { id: 5, at: '2026-08-16T10:00:00Z' }] }
]);
assert.equal(api.readMessageTimes(mixed).size, 0);

class ThrowingIntl {
  static DateTimeFormat() {
    throw new Error('intl unavailable');
  }
}
const fallbackTime = api.formatTime('2026-08-16T10:05:00Z', ThrowingIntl);
assert.match(fallbackTime, /^\d{2}:\d{2}$/);
assert.equal(api.formatExact('2026-08-16T10:05:00Z', ThrowingIntl), '2026-08-16T10:05:00.000Z');
assert.match(api.formatDay('2026-08-14T10:05:00Z', new Date('2026-08-16T10:05:00Z'), ThrowingIntl), /^\d{4}-\d{2}-\d{2}$/);

const nullDoc = { querySelector() { return null; }, createElement() { return {}; } };
const controller = api.createController({
  documentRef: nullDoc,
  storage: { getItem() { throw new Error('denied'); } },
  windowRef: {},
  MutationObserverImpl: null
});
assert.equal(controller.mount(), false);
const emptyRender = controller.render();
assert.equal(emptyRender.decorated, 0);
assert.equal(emptyRender.separators, 0);

for (const forbidden of [
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'setItem(', 'removeItem(',
  'document.cookie', 'navigator.clipboard', 'requestSubmit(', '.submit(', 'eval(', 'Function('
]) {
  assert.equal(source.includes(forbidden), false, `forbidden API found: ${forbidden}`);
}

console.log('message timeline edge tests passed');
