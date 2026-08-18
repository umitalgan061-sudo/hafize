import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const guard = require('../public/conversation-storage-guard.js');

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

const valid = JSON.stringify([{
  id: 'conv-1',
  title: 'Sohbet',
  agentId: 'minimal-engineer',
  toolsEnabled: false,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
  messages: [{ id: 'msg-1', role: 'user', content: 'Merhaba', at: '2026-08-18T12:00:00.000Z' }]
}]);

{
  const localStorage = makeStorage({ [guard.STORAGE_KEY]: valid });
  let reloads = 0;
  const result = guard.install({ localStorage, sessionStorage: makeStorage(), location: { reload() { reloads += 1; } } });
  assert.equal(result.changed, false);
  assert.equal(reloads, 0);
  assert.equal(localStorage.getItem(guard.STORAGE_KEY), valid);
}

{
  const localStorage = makeStorage({ [guard.STORAGE_KEY]: '{bad json' });
  const sessionStorage = makeStorage();
  let reloads = 0;
  const result = guard.install({ localStorage, sessionStorage, location: { reload() { reloads += 1; } } });
  assert.equal(result.changed, true);
  assert.equal(result.reason, 'invalid_json');
  assert.equal(localStorage.getItem(guard.STORAGE_KEY), '[]');
  assert.equal(reloads, 1);
  assert.equal(sessionStorage.getItem('hafizeConversationStorageGuardReloaded'), '1');
}

{
  const localStorage = makeStorage({ [guard.STORAGE_KEY]: JSON.stringify([{ nonsense: true }]) });
  const sessionStorage = makeStorage({ hafizeConversationStorageGuardReloaded: '1' });
  let reloads = 0;
  const result = guard.install({ localStorage, sessionStorage, location: { reload() { reloads += 1; } } });
  assert.equal(result.changed, true);
  assert.equal(reloads, 0);
  assert.equal(sessionStorage.getItem('hafizeConversationStorageGuardReloaded'), null);
}

{
  const localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('no'); } };
  const result = guard.install({ localStorage });
  assert.equal(result.error, 'storage_unavailable');
}

{
  const localStorage = makeStorage({ [guard.STORAGE_KEY]: '{bad json' });
  localStorage.setItem = () => { throw new Error('quota'); };
  const result = guard.install({ localStorage, location: { reload() { throw new Error('should not reload'); } } });
  assert.equal(result.error, 'storage_write_failed');
  assert.equal(result.changed, false);
}

console.log('conversation storage guard install tests passed');
