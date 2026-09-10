import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const policy = require(path.join(root, 'public/message-workspace-policy.js'));

function baseRecord(overrides = {}) {
  return {
    id: 'record-1',
    conversationId: 'conversation-1',
    messageId: 'message-1',
    saved: false,
    feedback: '',
    note: '',
    tags: [],
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-10T10:00:00.000Z',
    ...overrides
  };
}

const source = await readFile(path.join(root, 'public/message-workspace-policy.js'), 'utf8');

assert.equal(policy.MAX_RECORDS, 240);
assert.equal(policy.MAX_NOTE, 600);
assert.equal(policy.MAX_TAG, 24);
assert.equal(policy.MAX_TAGS, 8);
assert.equal(policy.MAX_QUERY, 120);
assert.equal(policy.MAX_EXPORT, 100);

assert.equal(policy.text('  merhaba   dünya  '), 'merhaba dünya');
assert.equal(policy.text(null), '');
assert.equal(policy.tag('### proje '), 'proje');
assert.equal(policy.tag('   #etiket test   '), 'etiket test');
assert.equal(policy.note('  satır 1\r\nsatır 2  '), 'satır 1\nsatır 2');
assert.equal(policy.feedback('up'), 'up');
assert.equal(policy.feedback('down'), 'down');
assert.equal(policy.feedback('middle'), '');

const longNote = 'x'.repeat(1200);
assert.equal(policy.note(longNote).length, 600);
const longTag = 'x'.repeat(80);
assert.equal(policy.tag(longTag).length, 24);
const tooManyTags = Array.from({ length: 15 }, (_, index) => `tag-${index}`);
const normalizedTags = policy.replaceTags(baseRecord(), tooManyTags);
assert.equal(normalizedTags.tags.length, 8);
assert.deepEqual(normalizedTags.tags.slice(0, 3), ['tag-0', 'tag-1', 'tag-2']);

assert.equal(policy.normalizeRecord(null), null);
assert.equal(policy.normalizeRecord({}), null);
assert.equal(policy.normalizeRecord({ conversationId: 'c' }), null);
assert.equal(policy.normalizeRecord({ messageId: 'm' }), null);

const normalized = policy.normalizeRecord(baseRecord({
  saved: 'yes',
  feedback: 'evil',
  note: longNote,
  tags: ['one', 'one', '##two'],
  createdAt: 'not-a-date',
  updatedAt: '2026-09-10T11:00:00.000Z'
}));
assert.ok(normalized);
assert.equal(normalized.saved, false);
assert.equal(normalized.feedback, '');
assert.equal(normalized.note.length, 600);
assert.deepEqual(normalized.tags, ['one', 'two']);
assert.equal(normalized.updatedAt, '2026-09-10T11:00:00.000Z');
assert.match(normalized.createdAt, /^\d{4}-\d{2}-\d{2}T/);

const empty = policy.normalizeRecord(baseRecord());
assert.deepEqual(policy.normalizeRecords([empty, empty, null]), []);

const richA = baseRecord({ id: 'a', saved: true, updatedAt: '2026-09-10T12:00:00.000Z' });
const richB = baseRecord({ id: 'b', feedback: 'up', updatedAt: '2026-09-10T13:00:00.000Z' });
const richC = baseRecord({ id: 'c', note: 'not', updatedAt: '2026-09-10T14:00:00.000Z' });
const records = policy.normalizeRecords([richA, richB, richC, empty]);
assert.equal(records.length, 3);
assert.deepEqual(policy.canExport(records, ['a', 'c']).map((record) => record.id), ['a', 'c']);
assert.equal(policy.canExport(records, []).length, 0);

const userItem = { role: 'user', content: 'Önemli taslak metni', record: richA };
const assistantItem = { role: 'assistant', content: 'Önemli yanıt', record: richB };
const noteItem = { role: 'assistant', content: 'başka', record: richC };
const normalizedState = policy.normalizeState({ query: ' ÖNEMLİ ', filter: 'saved', sort: 'oldest', selected: ['a', 'a', 7] });
assert.deepEqual(normalizedState, { query: 'önemli', filter: 'saved', sort: 'oldest', selected: ['a'] });

assert.equal(policy.matches(userItem, normalizedState), true);
assert.equal(policy.matches(assistantItem, normalizedState), false);
assert.equal(policy.matches({ ...userItem, record: { ...richA, saved: false } }, normalizedState), false);
assert.equal(policy.matches({ ...assistantItem, record: richB }, policy.normalizeState({ filter: 'assistant' })), true);
assert.equal(policy.matches({ ...userItem, record: richA }, policy.normalizeState({ filter: 'user' })), true);
assert.equal(policy.matches(noteItem, policy.normalizeState({ filter: 'notes' })), true);
assert.equal(policy.matches(richA, policy.normalizeState({ filter: 'notes' })), false);
assert.equal(policy.matches({ ...noteItem, record: { ...richC, tags: ['x'] } }, policy.normalizeState({ filter: 'tag' })), true);
assert.equal(policy.matches(noteItem, policy.normalizeState({ query: 'yanıt' })), false);
assert.equal(policy.matches(assistantItem, policy.normalizeState({ query: 'yanıt' })), true);

const sortedNewest = policy.sort([richA, richB, richC], 'newest');
assert.deepEqual(sortedNewest.map((record) => record.id), ['c', 'b', 'a']);
const sortedOldest = policy.sort([richA, richB, richC], 'oldest');
assert.deepEqual(sortedOldest.map((record) => record.id), ['a', 'b', 'c']);
const feedbackFirst = policy.sort([richA, richB, richC], 'feedback');
assert.equal(feedbackFirst[0].feedback, 'up');
const notesFirst = policy.sort([richA, richB, richC], 'notes');
assert.equal(notesFirst[0].note, 'not');

const toggledSaved = policy.toggleSaved(richA);
assert.equal(toggledSaved.saved, false);
const toggledUp = policy.toggleFeedback(richB, 'up');
assert.equal(toggledUp.feedback, '');
const toggledDown = policy.toggleFeedback(richB, 'down');
assert.equal(toggledDown.feedback, 'down');
const replacedNote = policy.replaceNote(richA, 'Yeni not');
assert.equal(replacedNote.note, 'Yeni not');
const replacedTags = policy.replaceTags(richA, ['a', '#b', 'a']);
assert.deepEqual(replacedTags.tags, ['a', 'b']);
assert.equal(policy.isEmpty(policy.normalizeRecord(baseRecord({ saved: false }))), true);
assert.equal(policy.isEmpty(policy.toggleSaved(empty)), false);

for (let count = 0; count < 300; count += 1) {
  const batch = Array.from({ length: 2 }, (_, index) => baseRecord({
    id: `bulk-${count}-${index}`,
    saved: true,
    conversationId: `c-${count}`,
    messageId: `m-${index}`
  }));
  assert.equal(policy.normalizeRecords(batch).length, 2);
}

assert.ok(source.includes("HafizeMessageWorkspacePolicy"));
assert.ok(source.includes("MAX_EXPORT"));
assert.ok(source.includes("toLocaleLowerCase('tr-TR')"));
assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('XMLHttpRequest'));
assert.ok(!source.includes('WebSocket'));

console.log('message workspace policy tests passed');
