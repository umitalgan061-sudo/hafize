import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');

function storage(values = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    map
  };
}

const dirtyConversation = JSON.stringify([{
  id: 'c1',
  title: 'Başlık',
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
  messages: [{ id: 'm1', role: 'user', content: 'Merhaba', at: '2026-08-18T12:00:00.000Z', unknown: true }],
  unknown: true
}]);

{
  const local = storage({ [guard.STORAGE_KEY]: dirtyConversation });
  const session = storage();
  let reloads = 0;
  const first = guard.install({ localStorage: local, sessionStorage: session, location: { reload() { reloads += 1; } } });
  assert.equal(first.changed, true);
  assert.equal(first.reloaded, true);
  assert.equal(reloads, 1);
  assert.equal(session.getItem('hafizeConversationStorageGuardReloaded'), '1');

  const second = guard.install({ localStorage: local, sessionStorage: session, location: { reload() { reloads += 1; } } });
  assert.equal(second.changed, false);
  assert.equal(second.reloaded, false);
  assert.equal(reloads, 1);
}

{
  const local = storage({ [guard.STORAGE_KEY]: '{broken' });
  const session = storage({ hafizeConversationStorageGuardReloaded: '1' });
  let reloads = 0;
  const result = guard.install({ localStorage: local, sessionStorage: session, location: { reload() { reloads += 1; } } });
  assert.equal(result.changed, true);
  assert.equal(result.reloaded, false);
  assert.equal(reloads, 0);
  assert.equal(session.getItem('hafizeConversationStorageGuardReloaded'), null);
  assert.equal(local.getItem(guard.STORAGE_KEY), '[]');
}

{
  const local = storage({ [guard.STORAGE_KEY]: '{broken' });
  let reloads = 0;
  const badSession = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); }
  };
  const result = guard.install({ localStorage: local, sessionStorage: badSession, location: { reload() { reloads += 1; } } });
  assert.equal(result.changed, true);
  assert.equal(result.error, null);
  assert.equal(reloads, 0);
  assert.equal(local.getItem(guard.STORAGE_KEY), '[]');
}

{
  const local = storage();
  const result = guard.install({ localStorage: local, sessionStorage: storage(), location: { reload() {} } });
  assert.equal(result.changed, false);
  assert.equal(result.reloaded, false);
}

console.log('conversation storage guard reload tests passed');
