import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const now = new Date().toISOString();

function message(id, content, role = 'user') {
  return { id, role, content, at: now };
}

const decomposed = 'e\u0301'.repeat(10);
const normalized = guard.normalizeMessage(message('unicode', decomposed));
assert.equal(normalized.content, 'é'.repeat(10));
assert.equal(normalized.content.length, 10);

const emoji = '🛰️'.repeat(100);
const emojiMessage = guard.normalizeMessage(message('emoji', emoji));
assert.ok(emojiMessage.content.length <= guard.MAX_MESSAGE_CHARS);

const bounded = guard.normalizeMessages([
  message('old', 'a'.repeat(10)),
  message('new', 'b'.repeat(10))
], 10);
assert.deepEqual(bounded.map((item) => item.id), ['new']);

const emptyAssistant = guard.normalizeMessages([
  message('user', 'hello'),
  message('assistant-empty', '', 'assistant')
], 5);
assert.deepEqual(emptyAssistant.map((item) => item.id), ['user', 'assistant-empty']);
assert.equal(guard.conversationContentChars({ messages: emptyAssistant }), 5);

console.log('conversation storage unicode budget: ok');
