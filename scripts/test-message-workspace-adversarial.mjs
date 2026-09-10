import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const policy = require(path.join(root, 'public/message-workspace-policy.js'));
const source = await readFile(path.join(root, 'public/message-workspace.js'), 'utf8');

function record(overrides = {}) {
  return policy.normalizeRecord({
    id: 'r',
    conversationId: 'c',
    messageId: 'm',
    saved: true,
    feedback: 'up',
    note: 'not',
    tags: ['a'],
    createdAt: '2026-09-10T12:00:00Z',
    updatedAt: '2026-09-10T12:00:00Z',
    ...overrides
  });
}

const prototypePoison = Object.create({ feedback: 'down', saved: true });
prototypePoison.id = 'own';
prototypePoison.conversationId = 'c';
prototypePoison.messageId = 'm';
prototypePoison.tags = [];
prototypePoison.note = '';
prototypePoison.createdAt = '2026-09-10T12:00:00Z';
prototypePoison.updatedAt = '2026-09-10T12:00:00Z';
const safePrototype = policy.normalizeRecord(prototypePoison);
assert.equal(safePrototype.feedback, '');
assert.equal(safePrototype.saved, false);

const weirdTags = [' #one ', '#one', '##two', '', '   ', 'a'.repeat(500), null, 42];
const normalized = record({ tags: weirdTags });
assert.deepEqual(normalized.tags.slice(0, 4), ['one', 'two', 'a'.repeat(24)]);
assert.ok(normalized.tags.length <= 8);

const hugeIds = record({ conversationId: 'x'.repeat(1000), messageId: 'y'.repeat(1000), id: 'z'.repeat(1000) });
assert.equal(hugeIds.conversationId.length, 120);
assert.equal(hugeIds.messageId.length, 120);
assert.equal(hugeIds.id.length, 120);

for (const value of [undefined, null, false, 0, {}, [], 'true', 'UP', 'down ']) {
  assert.equal(policy.feedback(value), value === 'down ' ? '' : '');
}

const weirdState = policy.normalizeState({
  query: '<img src=x onerror=alert(1)>',
  filter: 'drop-table',
  sort: 'arbitrary',
  selected: Array.from({ length: 500 }, (_, index) => index % 4 === 0 ? `id-${index}` : { value: index })
});
assert.equal(weirdState.filter, 'all');
assert.equal(weirdState.sort, 'newest');
assert.equal(weirdState.selected.length, 100);
assert.equal(weirdState.query.includes('<img'), true);

const htmlLike = record({ note: '<script>alert(1)</script>', tags: ['<svg>'] });
assert.equal(htmlLike.note, '<script>alert(1)</script>');
assert.deepEqual(htmlLike.tags, ['<svg>']);
assert.equal(policy.isEmpty(htmlLike), false);

const noActions = policy.normalizeRecord({
  conversationId: 'c',
  messageId: 'm',
  saved: false,
  feedback: '',
  note: '',
  tags: []
});
assert.ok(noActions);
assert.equal(policy.isEmpty(noActions), true);

const duplicates = policy.normalizeRecords([
  record({ id: 'dup' }),
  record({ id: 'dup', note: 'second' }),
  record({ id: 'unique', saved: true, feedback: '', note: '', tags: [] })
]);
assert.equal(duplicates.length, 2);
assert.equal(duplicates.filter(item => item.id === 'dup').length, 1);

const exportRecords = policy.canExport(
  Array.from({ length: 140 }, (_, index) => record({ id: `r-${index}` })),
  Array.from({ length: 140 }, (_, index) => `r-${index}`)
);
assert.equal(exportRecords.length, 100);
assert.equal(exportRecords[99].id, 'r-99');

assert.equal(policy.matches({ role: 'assistant', content: 'olağan yanıt', record: record({ saved: false, feedback: '', note: '', tags: [] }) }, policy.normalizeState({ filter: 'saved' })), false);
assert.equal(policy.matches({ role: 'assistant', content: 'olağan yanıt', record: record({ note: 'hedef not' }) }, policy.normalizeState({ query: 'hedef' })), true);
assert.equal(policy.matches({ role: 'assistant', content: 'OLAĞAN', record: record({ note: '' }) }, policy.normalizeState({ query: 'olağan' })), true);

for (const name of ['eval', 'Function(', 'document.cookie', 'navigator.clipboard.read', '/api/', 'fetch(', 'XMLHttpRequest', 'WebSocket']) {
  assert.equal(source.includes(name), false, `unexpected browser capability: ${name}`);
}

assert.ok(source.includes('textContent'));
assert.ok(source.includes('createElement'));
assert.ok(source.includes('setAttribute'));
assert.ok(source.includes('localStorage.setItem'));
// Okuma yolu enjekte edilebilir bir `storage` parametresi kullanır; varsayılanı localStorage'dır.
assert.ok(source.includes('storage.getItem'));
assert.ok(source.includes('storage = localStorage'));
assert.ok(source.includes('window.addEventListener'));
assert.ok(source.includes('storage'));
assert.ok(source.includes('CustomEvent'));

const destructiveWords = ['deleteDatabase', 'removeItem(\'hafize.conversations.v1\'', 'clearHistory'];
for (const token of destructiveWords) {
  assert.equal(source.includes(token), false, `message workspace must not own conversation deletion: ${token}`);
}

console.log('message workspace adversarial tests passed');
