import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
const store = new Map();
const sandbox = {
  localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k,v) => store.set(k,v) },
  crypto: { randomUUID: (() => { let n = 0; return () => `r-${++n}`; })() },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; }, Event: class {}, StorageEvent: class {}
};
vm.runInNewContext(source, sandbox);
const api = sandbox.HafizePromptLibraryRevisions;
for (let i = 0; i < 12; i += 1) api.capture({ id: 'p', title: `v${i}`, body: `body-${i}`, tags: [] });
assert.equal(api.list('p').length, 10);
assert.equal(api.list('p')[0].title, 'v11');
assert.equal(api.list('p').at(-1).title, 'v2');
console.log('revision retention runtime: ok');
