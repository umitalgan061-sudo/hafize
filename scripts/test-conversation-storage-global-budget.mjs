import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');

function conversation(index, messages = 12, size = 10_000) {
  const updatedAt = new Date(Date.UTC(2026, 0, 1, 0, index, 0)).toISOString();
  return {
    id: `c-${index}`,
    title: `Conversation ${index}`,
    createdAt: updatedAt,
    updatedAt,
    messages: Array.from({ length: messages }, (_, messageIndex) => ({
      id: `c-${index}-m-${messageIndex}`,
      role: messageIndex % 2 ? 'assistant' : 'user',
      content: 'x'.repeat(size),
      at: updatedAt
    }))
  };
}

const input = Array.from({ length: 20 }, (_, index) => conversation(index));
const normalized = guard.normalizeConversations(input);
const total = normalized.reduce((sum, item) => sum + guard.conversationContentChars(item), 0);

assert.ok(total <= guard.MAX_TOTAL_CONTENT_CHARS);
assert.equal(normalized[0].id, 'c-19', 'newest conversation must be retained first');
assert.equal(normalized.at(-1).id, 'c-10', 'budget should retain newest ten full conversations');
assert.equal(normalized.length, 10);
assert.ok(normalized.every((item) => guard.conversationContentChars(item) <= guard.MAX_CONVERSATION_CONTENT_CHARS));

const partial = guard.normalizeConversations([
  conversation(1, 12, 10_000),
  conversation(2, 12, 10_000),
  conversation(3, 12, 10_000)
]);
assert.equal(partial.length, 3);
assert.equal(partial[0].id, 'c-3');

const serialized = guard.sanitizeStoredValue(JSON.stringify(input));
const roundTrip = JSON.parse(serialized.serialized);
const serializedTotal = roundTrip.reduce((sum, item) => sum + item.messages.reduce((n, message) => n + message.content.length, 0), 0);
assert.ok(serializedTotal <= guard.MAX_TOTAL_CONTENT_CHARS);
assert.equal(roundTrip[0].id, 'c-19');

console.log('conversation storage global budget: ok');
