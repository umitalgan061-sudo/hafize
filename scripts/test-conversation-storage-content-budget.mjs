import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const now = new Date().toISOString();

function message(index, size) {
  return {
    id: `m-${index}`,
    role: index % 2 ? 'assistant' : 'user',
    content: String(index).padStart(4, '0') + 'x'.repeat(Math.max(0, size - 4)),
    at: now
  };
}

const size = 10_000;
const values = Array.from({ length: 20 }, (_, index) => message(index, size));
const normalized = guard.normalizeMessages(values);
assert.equal(normalized.length, 12);
assert.equal(normalized[0].id, 'm-8');
assert.equal(normalized.at(-1).id, 'm-19');
assert.ok(guard.conversationContentChars({ messages: normalized }) <= guard.MAX_CONVERSATION_CONTENT_CHARS);

const exact = guard.normalizeMessages([message(1, guard.MAX_CONVERSATION_CONTENT_CHARS)], guard.MAX_CONVERSATION_CONTENT_CHARS);
assert.equal(exact.length, 1);
assert.equal(exact[0].content.length, guard.MAX_MESSAGE_CHARS, 'message normalization remains the tighter single-message bound');

const zeroBudget = guard.normalizeMessages(values, 0);
assert.deepEqual(zeroBudget, []);

const tinyBudget = guard.normalizeMessages([
  message(1, 9),
  message(2, 7),
  message(3, 5)
], 12);
assert.deepEqual(tinyBudget.map((item) => item.id), ['m-2', 'm-3']);
assert.equal(guard.conversationContentChars({ messages: tinyBudget }), 12);

console.log('conversation storage content budget: ok');
