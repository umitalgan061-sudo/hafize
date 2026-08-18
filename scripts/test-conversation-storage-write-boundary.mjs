import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');

function createStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    dump(key) { return map.get(key); }
  };
}

function conversation(messageCount = 1) {
  const now = new Date().toISOString();
  return {
    id: 'conversation-1',
    title: 'A title',
    agentId: 'minimal-engineer',
    toolsEnabled: false,
    createdAt: now,
    updatedAt: now,
    messages: Array.from({ length: messageCount }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 ? 'assistant' : 'user',
      content: `content-${index}`,
      at: now,
      secret: 'must-not-persist'
    })),
    traceId: 'must-not-persist'
  };
}

const storage = createStorage();
const boundary = guard.installWriteBoundary(storage);
assert.ok(boundary);

storage.setItem('unrelated', '{"keep":true}');
assert.equal(storage.dump('unrelated'), '{"keep":true}');

storage.setItem(guard.STORAGE_KEY, JSON.stringify([conversation(guard.MAX_MESSAGES_PER_CONVERSATION + 7)]));
const persisted = JSON.parse(storage.dump(guard.STORAGE_KEY));
assert.equal(persisted.length, 1);
assert.equal(persisted[0].messages.length, guard.MAX_MESSAGES_PER_CONVERSATION);
assert.equal(persisted[0].messages[0].id, 'message-7');
assert.equal(persisted[0].messages.at(-1).id, `message-${guard.MAX_MESSAGES_PER_CONVERSATION + 6}`);
assert.equal('traceId' in persisted[0], false);
assert.equal(persisted[0].messages.some((item) => 'secret' in item), false);

storage.setItem(guard.STORAGE_KEY, '{bad json');
assert.equal(storage.dump(guard.STORAGE_KEY), '[]');

const second = guard.installWriteBoundary(storage);
assert.equal(second, boundary, 'installation must be idempotent');

const storageWithFailure = {
  getItem() { return null; },
  setItem() { throw new Error('quota'); }
};
const failingBoundary = guard.installWriteBoundary(storageWithFailure);
assert.ok(failingBoundary);
assert.throws(() => storageWithFailure.setItem(guard.STORAGE_KEY, '[]'), /quota/);

console.log('conversation storage write boundary: ok');
