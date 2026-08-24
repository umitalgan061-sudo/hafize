import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');

const now = '2026-08-18T12:00:00.000Z';

function message(overrides = {}) {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Merhaba',
    at: now,
    ...overrides
  };
}

function conversation(overrides = {}) {
  return {
    id: 'conv-1',
    title: 'Sohbet',
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: now,
    updatedAt: now,
    messages: [message()],
    ...overrides
  };
}

assert.equal(guard.normalizeId('abc-123'), 'abc-123');
assert.equal(guard.normalizeId('../unsafe'), null);
assert.equal(guard.normalizeId('x'.repeat(121)), null);
assert.equal(guard.normalizeAgentId('minimal-engineer'), 'minimal-engineer');
assert.equal(guard.normalizeAgentId('Bad Agent'), '');
assert.equal(guard.normalizeIsoTimestamp(now), now);
assert.equal(guard.normalizeIsoTimestamp('not-a-date'), null);

const cleanMessage = guard.normalizeMessage(message());
assert.deepEqual(cleanMessage, message());
assert.equal(guard.normalizeMessage(message({ role: 'system' })), null);
assert.equal(guard.normalizeMessage(message({ content: '' })), null);
assert.equal(guard.normalizeMessage(message({ content: 'x'.repeat(guard.MAX_MESSAGE_CHARS + 25) })).content.length, guard.MAX_MESSAGE_CHARS);

const assistant = guard.normalizeMessage(message({
  role: 'assistant',
  content: '',
  toolActivities: [
    { label: 'Repo oku', state: 'running' },
    { label: 'Tamam', ok: true },
    { label: '<script>alert(1)</script>', state: 'failure' },
    { label: 'Dördüncü', state: 'success' },
    { label: 'Beşinci', state: 'success' },
    { label: '', state: 'success' }
  ]
}));
assert.equal(assistant.toolActivities.length, 4);
assert.equal(assistant.toolActivities[1].state, 'success');
assert.equal(assistant.toolActivities[2].label, '<script>alert(1)</script>');

const manyMessages = Array.from({ length: guard.MAX_MESSAGES_PER_CONVERSATION + 20 }, (_, index) => message({
  id: `msg-${index}`,
  content: `mesaj-${index}`
}));
const bounded = guard.normalizeConversation(conversation({ messages: manyMessages }));
assert.equal(bounded.messages.length, guard.MAX_MESSAGES_PER_CONVERSATION);

const duplicateMessages = guard.normalizeConversation(conversation({
  messages: [message({ id: 'same' }), message({ id: 'same', content: 'ikinci' })]
}));
assert.equal(duplicateMessages.messages.length, 1);
assert.equal(duplicateMessages.messages[0].content, 'ikinci', 'newest duplicate message candidate wins during bounded reverse scan');

const conversations = Array.from({ length: guard.MAX_CONVERSATIONS + 5 }, (_, index) => conversation({
  id: `conv-${index}`,
  updatedAt: new Date(Date.parse(now) + index * 1000).toISOString(),
  messages: [message({ id: `m-${index}` })]
}));
const normalized = guard.normalizeConversations(conversations);
assert.equal(normalized.length, guard.MAX_CONVERSATIONS);
assert.equal(normalized[0].id, `conv-${guard.MAX_CONVERSATIONS - 1}`);

const duplicateConversations = guard.normalizeConversations([
  conversation({ id: 'dup' }),
  conversation({ id: 'dup', title: 'ikinci' })
]);
assert.equal(duplicateConversations.length, 1);
assert.equal(duplicateConversations[0].title, 'Sohbet');

console.log('conversation storage guard normalization tests passed');
