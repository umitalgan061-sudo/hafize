import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-storage-guard.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, Map, Set, WeakMap, Object, Array, Date, JSON, String, Number, RegExp });
const api = module.exports;

const iso = (minute) => `2026-08-18T18:${String(minute).padStart(2, '0')}:00.000Z`;
const message = (id, content, minute, role = 'user') => ({ id, role, content, at: iso(minute) });
const conversation = ({ id = 'c1', title = 'Sohbet', minute = 0, messages = [], agentId = 'minimal-engineer', toolsEnabled = false } = {}) => ({
  id,
  title,
  agentId,
  toolsEnabled,
  createdAt: iso(0),
  updatedAt: iso(minute),
  messages
});
const toHostValue = (value) => JSON.parse(JSON.stringify(value));

{
  const base = [conversation({ messages: [message('m1', 'ilk', 0)] })];
  const local = [conversation({ minute: 2, messages: [message('m1', 'ilk', 0), message('m2', 'yerel', 2)] })];
  const result = api.reconcileConversationSnapshots(base, base, local);
  assert.equal(result.conflicts, 0);
  assert.deepEqual(toHostValue(result.value), toHostValue(api.normalizeConversations(local)));
}

{
  const base = [conversation({ messages: [message('m1', 'ilk', 0)] })];
  const remote = [conversation({ minute: 2, messages: [message('m1', 'ilk', 0), message('m2', 'uzak', 2)] })];
  const result = api.reconcileConversationSnapshots(base, remote, base);
  assert.equal(result.conflicts, 0);
  assert.equal(result.remoteChangesPreserved, 1);
  assert.equal(result.value[0].messages.at(-1).content, 'uzak');
}

{
  const base = [conversation({ messages: [message('m1', 'ilk', 0)] })];
  const remote = [conversation({ minute: 2, messages: [message('m1', 'ilk', 0), message('m2', 'uzak', 2)] })];
  const local = [conversation({ minute: 3, messages: [message('m1', 'ilk', 0), message('m3', 'yerel', 3)] })];
  const result = api.reconcileConversationSnapshots(base, remote, local);
  assert.equal(result.conflicts, 1);
  assert.equal(result.remoteChangesPreserved, 1);
  assert.deepEqual(toHostValue(result.value[0].messages.map((item) => item.id)), ['m1', 'm2', 'm3']);
}

{
  const base = [conversation({ id: 'existing', messages: [message('m1', 'ilk', 0)] })];
  const remote = [
    conversation({ id: 'remote-new', minute: 3, messages: [message('r1', 'uzak yeni', 3)] }),
    ...base
  ];
  const local = [
    conversation({ id: 'local-new', minute: 4, messages: [message('l1', 'yerel yeni', 4)] }),
    ...base
  ];
  const result = api.reconcileConversationSnapshots(base, remote, local);
  assert.deepEqual(new Set(result.value.map((item) => item.id)), new Set(['existing', 'remote-new', 'local-new']));
  assert.equal(result.remoteChangesPreserved, 1);
}

{
  const base = [conversation({ minute: 1, messages: [message('m1', 'ilk', 0)] })];
  const remote = [conversation({ minute: 5, title: 'Uzak başlık', messages: [message('m1', 'ilk', 0), message('m2', 'uzak', 5)] })];
  const local = [];
  const result = api.reconcileConversationSnapshots(base, remote, local);
  assert.equal(result.conflicts, 1, 'local delete versus remote update must be treated as conflict');
  assert.equal(result.value.length, 1, 'remote update must not be destroyed by stale local deletion');
  assert.equal(result.value[0].title, 'Uzak başlık');
}

{
  const base = [conversation({ minute: 1, messages: [message('m1', 'ilk', 0)] })];
  const remote = [];
  const local = [conversation({ minute: 5, title: 'Yerel başlık', messages: [message('m1', 'ilk', 0), message('m2', 'yerel', 5)] })];
  const result = api.reconcileConversationSnapshots(base, remote, local);
  assert.equal(result.conflicts, 1, 'remote delete versus local update must be treated as conflict');
  assert.equal(result.value.length, 0, 'explicit remote deletion wins to avoid resurrecting deleted content');
}

{
  const base = [conversation({ messages: [message('same', 'ilk', 0)] })];
  const remote = [conversation({ minute: 2, messages: [message('same', 'uzak düzenleme', 0)] })];
  const local = [conversation({ minute: 3, messages: [message('same', 'yerel düzenleme', 0)] })];
  const result = api.reconcileConversationSnapshots(base, remote, local);
  assert.equal(result.value[0].messages.length, 1);
  assert.equal(result.value[0].messages[0].content, 'yerel düzenleme', 'newer conversation metadata breaks same-message edit ties');
}

{
  const store = new Map([[api.STORAGE_KEY, JSON.stringify([conversation({ messages: [message('m1', 'ilk', 0)] })])]]);
  const merges = [];
  const storage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); }
  };
  const originalSetItem = storage.setItem;
  const originalGetItem = storage.getItem;
  const writer = api.createConflictAwareWriter({
    storage,
    originalSetItem,
    originalGetItem,
    initialSerialized: store.get(api.STORAGE_KEY),
    onMerge: (detail) => merges.push(detail)
  });

  const remote = [conversation({ minute: 2, messages: [message('m1', 'ilk', 0), message('r1', 'uzak', 2)] })];
  originalSetItem.call(storage, api.STORAGE_KEY, JSON.stringify(remote));
  const local = [conversation({ minute: 3, messages: [message('m1', 'ilk', 0), message('l1', 'yerel', 3)] })];
  writer.write(api.STORAGE_KEY, JSON.stringify(local));
  const persisted = JSON.parse(store.get(api.STORAGE_KEY));
  assert.deepEqual(persisted[0].messages.map((item) => item.id), ['m1', 'r1', 'l1']);
  assert.equal(merges.length, 1);
  assert.equal(merges[0].conflicts, 1);
  assert.equal(typeof merges[0].remoteChangesPreserved, 'number');
}

{
  const passthrough = [];
  const storage = {
    getItem() { return '[]'; },
    setItem(key, value) { passthrough.push([key, value]); }
  };
  const writer = api.createConflictAwareWriter({
    storage,
    originalSetItem: storage.setItem,
    originalGetItem: storage.getItem,
    initialSerialized: '[]'
  });
  writer.write('hafize.theme.v1', 'dark');
  assert.deepEqual(passthrough, [['hafize.theme.v1', 'dark']], 'non-conversation keys must remain passthrough');
}

assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.clipboard|document\.cookie/);
assert.doesNotMatch(source, /ownerId|traceId|authorization|bearer|api[_-]?key|client[_-]?secret/i);
assert.doesNotMatch(source, /child_process|exec\s*\(|spawn\s*\(|shell\s*:\s*true/);
assert.match(source, /hafize:conversation-storage-merged/);
assert.match(source, /remote delete versus local update|explicit remote deletion wins|!remote\)/i);

console.log('conversation storage conflict tests passed');