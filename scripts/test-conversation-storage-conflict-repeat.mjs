import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-storage-guard.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, Map, Set, WeakMap, Object, Array, Date, JSON, String, Number, RegExp });
const api = module.exports;

const at = (minute) => `2026-08-18T19:${String(minute).padStart(2, '0')}:00.000Z`;
const msg = (id, content, minute) => ({ id, role: 'user', content, at: at(minute) });
const conv = (minute, messages) => ({
  id: 'c1',
  title: 'Sohbet',
  agentId: 'minimal-engineer',
  toolsEnabled: false,
  createdAt: at(0),
  updatedAt: at(minute),
  messages
});

const base = [conv(0, [msg('m1', 'ilk', 0)])];
const store = new Map([[api.STORAGE_KEY, JSON.stringify(base)]]);
const storage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); }
};
const rawSet = storage.setItem;
const rawGet = storage.getItem;
const notices = [];
const writer = api.createConflictAwareWriter({
  storage,
  originalSetItem: rawSet,
  originalGetItem: rawGet,
  initialSerialized: JSON.stringify(base),
  onMerge: (detail) => notices.push(detail)
});

const remote = [conv(1, [msg('m1', 'ilk', 0), msg('remote', 'uzak değişiklik', 1)])];
rawSet.call(storage, api.STORAGE_KEY, JSON.stringify(remote));

const staleFirst = [conv(2, [msg('m1', 'ilk', 0), msg('local-1', 'yerel bir', 2)])];
writer.write(api.STORAGE_KEY, JSON.stringify(staleFirst));
let persisted = JSON.parse(store.get(api.STORAGE_KEY));
assert.deepEqual(persisted[0].messages.map((item) => item.id), ['m1', 'remote', 'local-1']);
assert.equal(notices.length, 1);

const staleSecond = [conv(3, [msg('m1', 'ilk', 0), msg('local-1', 'yerel bir', 2), msg('local-2', 'yerel iki', 3)])];
writer.write(api.STORAGE_KEY, JSON.stringify(staleSecond));
persisted = JSON.parse(store.get(api.STORAGE_KEY));
assert.deepEqual(
  persisted[0].messages.map((item) => item.id),
  ['m1', 'remote', 'local-1', 'local-2'],
  'remote message must survive every later stale write from the same tab'
);
assert.equal(notices.length, 2, 'repeated stale writes remain observable without exposing content');
assert.equal(writer.snapshot().serialized, api.sanitizeStoredValue(JSON.stringify(staleSecond)).serialized);
assert.doesNotMatch(JSON.stringify(notices), /uzak değişiklik|yerel bir|yerel iki|Sohbet/);

console.log('conversation storage repeated conflict test passed');