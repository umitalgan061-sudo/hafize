import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/local-data-center.js', 'utf8');
const context = { globalThis: null, TextEncoder, console };
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.HafizeLocalDataCenter;
const data = new Map(api.STORES.map((store) => [store.key, '{}']));
const storage = { get length() { return data.size; }, key(i) { return [...data.keys()][i]; }, getItem(k) { return data.get(k) ?? null; }, removeItem(k) { data.delete(k); } };
assert.equal(api.clearStore('theme', storage).ok, true);
assert.equal(data.has('hafize.theme.v1'), false);
assert.equal(api.clearStore('not-allowlisted', storage).ok, false);
assert.equal(data.has('hafize.chat-drafts.v1'), true);
const result = api.clearAllKnown(storage);
assert.equal(result.ok, true);
assert.equal(data.size, 0);
console.log('local data center clear: ok');
