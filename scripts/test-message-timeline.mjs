import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/message-timeline.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {}, Date, Intl, Map, JSON });
const api = module.exports;

assert.equal(api.STORAGE_KEY, 'hafize.conversations.v1');
assert.equal(api.normalizeIso(null), null);
assert.equal(api.normalizeIso('x'), null);
assert.equal(api.normalizeIso('2026-08-16T12:00:00.000Z'), '2026-08-16T12:00:00.000Z');

const raw = JSON.stringify([
  {
    id: 'c1',
    messages: [
      { id: 'm1', at: '2026-08-16T12:00:00.000Z' },
      { id: 'm2', at: 'invalid' },
      { id: '', at: '2026-08-16T13:00:00.000Z' }
    ]
  },
  {
    id: 'c2',
    messages: [
      { id: 'm1', at: '2026-08-15T12:00:00.000Z' },
      { id: 'm3', at: '2026-08-15T12:00:00.000Z' }
    ]
  }
]);
const times = api.readMessageTimes(raw);
assert.equal(times.size, 2);
assert.equal(times.get('m1'), '2026-08-16T12:00:00.000Z');
assert.equal(times.get('m3'), '2026-08-15T12:00:00.000Z');
assert.equal(api.readMessageTimes('{broken').size, 0);
assert.equal(api.readMessageTimes('{}').size, 0);

const fixedNow = new Date('2026-08-16T15:00:00.000Z');
assert.equal(api.formatDay('2026-08-16T12:00:00.000Z', fixedNow), 'Bugün');
assert.equal(api.formatDay('2026-08-15T12:00:00.000Z', fixedNow), 'Dün');
assert.ok(api.formatDay('2026-08-14T12:00:00.000Z', fixedNow).includes('2026'));
assert.ok(api.formatTime('2026-08-16T12:00:00.000Z').length >= 4);
assert.ok(api.formatExact('2026-08-16T12:00:00.000Z').length > 6);
assert.equal(api.dayKey('invalid'), null);

const many = Array.from({ length: api.MAX_CONVERSATIONS + 3 }, (_, c) => ({
  messages: [{ id: `m-${c}`, at: '2026-08-16T12:00:00.000Z' }]
}));
assert.equal(api.readMessageTimes(JSON.stringify(many)).size, api.MAX_CONVERSATIONS);

const hugeConversation = [{
  messages: Array.from({ length: api.MAX_MESSAGES_PER_CONVERSATION + 2 }, (_, index) => ({
    id: `x-${index}`,
    at: '2026-08-16T12:00:00.000Z'
  }))
}];
assert.equal(api.readMessageTimes(JSON.stringify(hugeConversation)).size, api.MAX_MESSAGES_PER_CONVERSATION);

console.log('message timeline core tests passed');
