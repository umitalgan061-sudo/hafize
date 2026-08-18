import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');
const now = new Date().toISOString();

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    raw(key) { return values.get(key); }
  };
}

function conversation(count) {
  return [{
    id: 'conversation',
    title: 'title',
    agentId: 'minimal-engineer',
    createdAt: now,
    updatedAt: now,
    messages: Array.from({ length: count }, (_, index) => ({
      id: `m-${index}`,
      role: index % 2 ? 'assistant' : 'user',
      content: `c-${index}`,
      at: now
    }))
  }];
}

const dirty = JSON.stringify(conversation(205));
const localStorage = createStorage({ [guard.STORAGE_KEY]: dirty });
const sessionStorage = createStorage();
let reloads = 0;
const result = guard.install({
  localStorage,
  sessionStorage,
  location: { reload() { reloads += 1; } }
});

assert.equal(result.changed, true);
assert.equal(result.reloaded, true);
assert.equal(result.writeBoundary, true);
assert.equal(result.error, null);
assert.equal(reloads, 1);
let persisted = JSON.parse(localStorage.raw(guard.STORAGE_KEY));
assert.equal(persisted[0].messages.length, 200);
assert.equal(persisted[0].messages[0].id, 'm-5');

localStorage.setItem(guard.STORAGE_KEY, JSON.stringify(conversation(207)));
persisted = JSON.parse(localStorage.raw(guard.STORAGE_KEY));
assert.equal(persisted[0].messages.length, 200);
assert.equal(persisted[0].messages[0].id, 'm-7');
assert.equal(persisted[0].messages.at(-1).id, 'm-206');

localStorage.setItem('other', 'unchanged');
assert.equal(localStorage.raw('other'), 'unchanged');

const second = guard.install({ localStorage, sessionStorage, location: { reload() { reloads += 1; } } });
assert.equal(second.changed, false);
assert.equal(second.writeBoundary, true);
assert.equal(reloads, 1);

console.log('conversation storage installed write guard: ok');
