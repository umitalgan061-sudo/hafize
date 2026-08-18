import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const now = new Date().toISOString();

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    raw(key) { return values.get(key); }
  };
}

function heavyConversation(index) {
  return {
    id: `c-${index}`,
    title: `Heavy ${index}`,
    createdAt: now,
    updatedAt: new Date(Date.parse(now) + index * 1000).toISOString(),
    messages: Array.from({ length: 20 }, (_, messageIndex) => ({
      id: `c-${index}-m-${messageIndex}`,
      role: messageIndex % 2 ? 'assistant' : 'user',
      content: 'x'.repeat(10_000),
      at: now
    }))
  };
}

const storage = createStorage();
assert.ok(guard.installWriteBoundary(storage));
storage.setItem(guard.STORAGE_KEY, JSON.stringify(Array.from({ length: 20 }, (_, index) => heavyConversation(index))));

const persisted = JSON.parse(storage.raw(guard.STORAGE_KEY));
const total = persisted.reduce((sum, conversation) => (
  sum + conversation.messages.reduce((messageSum, message) => messageSum + message.content.length, 0)
), 0);

assert.ok(total <= guard.MAX_TOTAL_CONTENT_CHARS);
assert.ok(persisted.length <= guard.MAX_CONVERSATIONS);
assert.equal(persisted[0].id, 'c-19');
assert.ok(persisted.every((conversation) => (
  conversation.messages.reduce((sum, message) => sum + message.content.length, 0) <= guard.MAX_CONVERSATION_CONTENT_CHARS
)));
assert.equal(storage.raw(guard.STORAGE_KEY).includes('undefined'), false);

storage.setItem('unrelated-budget-key', 'x'.repeat(100));
assert.equal(storage.raw('unrelated-budget-key'), 'x'.repeat(100));

console.log('conversation storage budget write boundary: ok');
