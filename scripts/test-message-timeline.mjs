import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/message-timeline.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {}, Date, Intl, Map, JSON, Promise, queueMicrotask });
const api = module.exports;

assert.equal(api.STORAGE_KEY, 'hafize.conversations.v1');
assert.equal(api.MAX_CONVERSATIONS, 30);
assert.equal(api.MAX_MESSAGES_PER_CONVERSATION, 200);
assert.equal(api.MAX_ID_CHARS, 120);
assert.equal(api.MAX_STORAGE_CHARS, 2 * 1024 * 1024);
assert.equal(api.normalizeId(' c1 '), 'c1');
assert.equal(api.normalizeId('../bad'), null);
assert.equal(api.normalizeId('x'.repeat(121)), null);
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
      { id: 'm3', at: '2026-08-15T13:00:00.000Z' }
    ]
  }
]);

const c1Times = api.readMessageTimes(raw, 'c1');
assert.equal(c1Times.size, 1);
assert.equal(c1Times.get('m1'), '2026-08-16T12:00:00.000Z');
assert.equal(c1Times.has('m3'), false, 'another conversation must not leak into the active timeline');

const c2Times = api.readMessageTimes(raw, 'c2');
assert.equal(c2Times.size, 2);
assert.equal(c2Times.get('m1'), '2026-08-15T12:00:00.000Z', 'duplicate message ids must resolve inside the selected conversation only');
assert.equal(c2Times.get('m3'), '2026-08-15T13:00:00.000Z');
assert.equal(api.readMessageTimes(raw, 'missing').size, 0);
assert.equal(api.readMessageTimes(raw, '../bad').size, 0);
assert.equal(api.readMessageTimes('{broken', 'c1').size, 0);
assert.equal(api.readMessageTimes('{}', 'c1').size, 0);
assert.deepEqual(Array.from(api.parseConversationList('{broken')), []);
assert.deepEqual(Array.from(api.parseConversationList('x'.repeat(api.MAX_STORAGE_CHARS + 1))), [], 'oversized raw storage must be rejected before JSON.parse');

function classList(active = false) {
  return { contains(name) { return name === 'active' && active; } };
}

function activeDocument(rows) {
  return {
    querySelectorAll(selector) {
      return selector === '#conversationList .conversation-row' ? rows : [];
    }
  };
}

const untaggedRows = [
  { classList: classList(true), dataset: {} },
  { classList: classList(false), dataset: {} }
];
assert.equal(api.activeConversationId(activeDocument(untaggedRows), raw), 'c1', 'pre-organizer source order may be used only while every row is untagged');

const organizedRows = [
  { classList: classList(false), dataset: { conversationOrganizeId: 'c1' } },
  { classList: classList(true), dataset: { conversationOrganizeId: 'c2' } }
];
assert.equal(api.activeConversationId(activeDocument(organizedRows), raw), 'c2');

const partiallyTaggedRows = [
  { classList: classList(true), dataset: {} },
  { classList: classList(false), dataset: { conversationOrganizeId: 'c2' } }
];
assert.equal(api.activeConversationId(activeDocument(partiallyTaggedRows), raw), null, 'mixed identity state must fail closed instead of trusting row index');
assert.equal(api.activeConversationId(activeDocument([
  { classList: classList(true), dataset: { conversationOrganizeId: 'c1' } },
  { classList: classList(true), dataset: { conversationOrganizeId: 'c2' } }
]), raw), null, 'ambiguous active rows must fail closed');

const fixedNow = new Date('2026-08-16T15:00:00.000Z');
assert.equal(api.formatDay('2026-08-16T12:00:00.000Z', fixedNow), 'Bugün');
assert.equal(api.formatDay('2026-08-15T12:00:00.000Z', fixedNow), 'Dün');
assert.ok(api.formatDay('2026-08-14T12:00:00.000Z', fixedNow).includes('2026'));
assert.ok(api.formatTime('2026-08-16T12:00:00.000Z').length >= 4);
assert.ok(api.formatExact('2026-08-16T12:00:00.000Z').length > 6);
assert.equal(api.dayKey('invalid'), null);

const many = Array.from({ length: api.MAX_CONVERSATIONS + 3 }, (_, index) => ({
  id: `c-${index}`,
  messages: [{ id: `m-${index}`, at: '2026-08-16T12:00:00.000Z' }]
}));
assert.equal(api.parseConversationList(JSON.stringify(many)).length, api.MAX_CONVERSATIONS);
assert.equal(api.readMessageTimes(JSON.stringify(many), 'c-29').size, 1);
assert.equal(api.readMessageTimes(JSON.stringify(many), 'c-30').size, 0, 'conversation scan remains bounded');

const hugeConversation = [{
  id: 'huge',
  messages: Array.from({ length: api.MAX_MESSAGES_PER_CONVERSATION + 2 }, (_, index) => ({
    id: `x-${index}`,
    at: '2026-08-16T12:00:00.000Z'
  }))
}];
assert.equal(api.readMessageTimes(JSON.stringify(hugeConversation), 'huge').size, api.MAX_MESSAGES_PER_CONVERSATION);

console.log('message timeline core tests passed');
