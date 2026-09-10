import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const policy = require(path.join(root, 'public/message-workspace-policy.js'));

function raw(index, overrides = {}) {
  return {
    id: `record-${index}`,
    conversationId: `conversation-${index % 3}`,
    messageId: `message-${index}`,
    saved: index % 2 === 0,
    feedback: index % 3 === 0 ? 'up' : index % 3 === 1 ? 'down' : '',
    note: index % 4 === 0 ? `note-${index}` : '',
    tags: [`tag-${index % 10}`, `tag-${index % 5}`],
    createdAt: '2026-09-10T10:00:00Z',
    updatedAt: `2026-09-10T${String(10 + (index % 10)).padStart(2,'0')}:00:00Z`,
    ...overrides
  };
}

const records = Array.from({ length: 400 }, (_, index) => raw(index));
const normalized = policy.normalizeRecords(records);
assert.equal(normalized.length, 240);
assert.equal(normalized.some(item => !item.saved && !item.feedback && !item.note && !item.tags.length), false);
assert.equal(new Set(normalized.map(item => item.id)).size, normalized.length);

const duplicateInput = [raw(1), raw(1), raw(2), { ...raw(3), id: raw(2).id }];
const duplicateOutput = policy.normalizeRecords(duplicateInput);
assert.deepEqual(duplicateOutput.map(item => item.id), ['record-1', 'record-2']);

const stateCases = [
  {},
  { filter: 'saved', sort: 'newest', query: 'hello', selected: ['a'] },
  { filter: 'assistant', sort: 'feedback', query: '  Foo  ', selected: ['a', 'b'] },
  { filter: 'notes', sort: 'notes', query: 'İstanbul', selected: ['x', 'x', 'y'] }
];
for (const input of stateCases) {
  const state = policy.normalizeState(input);
  assert.ok(['all','saved','feedback','notes','user','assistant','tag'].includes(state.filter));
  assert.ok(['newest','oldest','feedback','notes'].includes(state.sort));
  assert.equal(new Set(state.selected).size, state.selected.length);
}

const selectedIds = normalized.slice(0, 110).map(item => item.id);
const exportList = policy.canExport(normalized, selectedIds);
assert.equal(exportList.length, 100);
assert.equal(new Set(exportList.map(item => item.id)).size, 100);

const roleSamples = [
  { role: 'user', content: 'bir kayıt', record: normalized[0] },
  { role: 'assistant', content: 'başka kayıt', record: normalized[1] }
];
assert.equal(policy.matches(roleSamples[0], policy.normalizeState({ filter: 'user' })), true);
assert.equal(policy.matches(roleSamples[1], policy.normalizeState({ filter: 'user' })), false);
assert.equal(policy.matches(roleSamples[1], policy.normalizeState({ filter: 'assistant' })), true);

const update1 = policy.toggleSaved(normalized[0]);
assert.notEqual(update1.saved, normalized[0].saved);
const update2 = policy.toggleFeedback(normalized[1], 'down');
assert.equal(update2.feedback, normalized[1].feedback === 'down' ? '' : 'down');
const update3 = policy.replaceNote(normalized[2], '   ');
assert.equal(update3.note, '');
const update4 = policy.replaceTags(normalized[3], 'a, b, a, ##c');
assert.deepEqual(update4.tags, ['a','b','c']);

const legacy = policy.normalizeRecord({
  conversationId: 'legacy-conversation',
  messageId: 'legacy-message',
  saved: true
});
assert.ok(legacy);
assert.equal(legacy.feedback, '');
assert.equal(legacy.note, '');
assert.deepEqual(legacy.tags, []);

const partial = policy.normalizeRecord({
  conversationId: 'c',
  messageId: 'm',
  feedback: 'up',
  note: 123,
  tags: { bad: true }
});
assert.equal(partial.feedback, 'up');
assert.equal(partial.note, '123');
assert.deepEqual(partial.tags, []);

for (let index = 0; index < 40; index += 1) {
  const value = raw(index, { note: 'x'.repeat(601), tags: Array.from({ length: 12 }, (_, tagIndex) => `#tag-${tagIndex}`) });
  const item = policy.normalizeRecord(value);
  assert.equal(item.note.length, 600);
  assert.equal(item.tags.length, 8);
}

console.log('message workspace compatibility tests passed');
