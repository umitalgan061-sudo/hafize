import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/local-data-center.js', 'utf8');
const context = { globalThis: null, TextEncoder, console };
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.HafizeLocalDataCenter;
assert.ok(api);
assert.equal(api.STORES.length, 8);
const storage = {
  data: new Map([
    ['hafize.conversations.v1', '[1,2]'],
    ['hafize.prompt-library.v1', '[{"id":"p1"}]'],
    ['hafize.unknown.v9', 'x']
  ]),
  get length() { return this.data.size; },
  key(index) { return [...this.data.keys()][index] ?? null; },
  getItem(key) { return this.data.get(key) ?? null; },
  removeItem(key) { this.data.delete(key); }
};
const snapshot = api.inspect(storage);
assert.equal(snapshot.find((item) => item.id === 'conversations')?.count, '2 kayıt');
assert.equal(api.unknownKeys(storage)[0], 'hafize.unknown.v9');
assert.equal(api.clearStore('conversations', storage).ok, true);
assert.equal(storage.getItem('hafize.conversations.v1'), null);
assert.equal(api.clearStore('nope', storage).ok, false);
assert.equal(api.clearStores(['prompt-library', 'prompt-library'], storage).results.length, 2);
console.log('local data center storage: ok');
