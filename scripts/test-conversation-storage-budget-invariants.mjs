import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const now = new Date().toISOString();

assert.equal(Number.isInteger(guard.MAX_CONVERSATION_CONTENT_CHARS), true);
assert.equal(Number.isInteger(guard.MAX_TOTAL_CONTENT_CHARS), true);
assert.equal(Number.isInteger(guard.MAX_CONVERSATION_CANDIDATES), true);
assert.ok(guard.MAX_CONVERSATION_CONTENT_CHARS >= guard.MAX_MESSAGE_CHARS);
assert.ok(guard.MAX_TOTAL_CONTENT_CHARS >= guard.MAX_CONVERSATION_CONTENT_CHARS);
assert.ok(guard.MAX_CONVERSATION_CANDIDATES >= guard.MAX_CONVERSATIONS);
assert.ok(guard.MAX_CONVERSATION_CANDIDATES <= guard.MAX_CONVERSATIONS * 4);

const conversation = {
  id: 'c',
  title: 'c',
  createdAt: now,
  updatedAt: now,
  messages: [
    { id: 'old-large', role: 'user', content: 'a'.repeat(12_000), at: now },
    { id: 'middle', role: 'assistant', content: 'b'.repeat(4_000), at: now },
    { id: 'newest', role: 'user', content: 'c'.repeat(4_000), at: now }
  ]
};

const bounded = guard.normalizeConversation(conversation, 8_000);
assert.deepEqual(bounded.messages.map((message) => message.id), ['middle', 'newest']);
assert.equal(guard.conversationContentChars(bounded), 8_000);

const normalizedAgain = guard.normalizeConversation(bounded, 8_000);
assert.deepEqual(normalizedAgain, bounded, 'normalization should be stable for already bounded values');

const zero = guard.normalizeConversation(conversation, 0);
assert.deepEqual(zero.messages, []);
assert.equal(guard.conversationContentChars(zero), 0);

console.log('conversation storage budget invariants: ok');
