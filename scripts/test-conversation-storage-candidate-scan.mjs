import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const now = new Date().toISOString();

function validConversation(index, updatedAt = now) {
  return {
    id: `c-${index}`,
    title: `Conversation ${index}`,
    createdAt: updatedAt,
    updatedAt,
    messages: [{ id: `m-${index}`, role: 'user', content: `message-${index}`, at: updatedAt }]
  };
}

const input = Array.from({ length: guard.MAX_CONVERSATION_CANDIDATES + 50 }, (_, index) => validConversation(index));
input[guard.MAX_CONVERSATION_CANDIDATES + 10] = validConversation('late', new Date(Date.UTC(2030, 0, 1)).toISOString());
const normalized = guard.normalizeConversations(input);
assert.equal(normalized.length, guard.MAX_CONVERSATIONS);
assert.equal(normalized.some((item) => item.id === 'c-late'), false, 'candidates beyond the bounded scan are not parsed');

const unsorted = [
  validConversation('old', '2026-01-01T00:00:00.000Z'),
  validConversation('new', '2026-01-03T00:00:00.000Z'),
  validConversation('middle', '2026-01-02T00:00:00.000Z')
];
assert.deepEqual(guard.normalizeConversations(unsorted).map((item) => item.id), ['c-new', 'c-middle', 'c-old']);

const duplicates = [
  validConversation('dup', '2026-01-03T00:00:00.000Z'),
  { ...validConversation('dup', '2026-01-04T00:00:00.000Z'), title: 'duplicate should not win' },
  validConversation('other', '2026-01-02T00:00:00.000Z')
];
const deduped = guard.normalizeConversations(duplicates);
assert.equal(deduped.filter((item) => item.id === 'c-dup').length, 1);
assert.equal(deduped.find((item) => item.id === 'c-dup').title, 'Conversation dup');

console.log('conversation storage candidate scan: ok');
