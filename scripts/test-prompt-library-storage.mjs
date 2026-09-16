import assert from 'node:assert/strict';
// public/prompt-library.js is a browser UMD bundle: it assigns `module.exports`
// at runtime, which Node cannot statically analyse into named exports, so the
// suite takes the default (CommonJS) export and destructures it.
import promptLibrary from '../public/prompt-library.js';
const { STORAGE_KEY, STATE_KEY, saveItems, saveState, loadItems, loadState, normalizeItem } = promptLibrary;

const data = new Map();
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value)
};
const item = normalizeItem({ id: 'one', title: 'One', body: 'Body' });
assert.equal(saveItems(storage, [item]), true);
assert.equal(loadItems(storage).length, 1);
assert.equal(loadItems(storage)[0].id, 'one');
assert.equal(data.has(STORAGE_KEY), true);
assert.equal(saveState(storage, { query: 'kod', tag: 'all', favoriteOnly: true, sort: 'updated-desc' }), true);
assert.equal(loadState(storage).query, 'kod');
assert.equal(data.has(STATE_KEY), true);

const brokenRead = { getItem: () => '{broken', setItem: () => { throw new Error('quota'); } };
assert.deepEqual(loadItems(brokenRead), []);
assert.deepEqual(loadState(brokenRead), { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' });
assert.equal(saveItems(brokenRead, [item]), false);
assert.equal(saveState(brokenRead, {}), false);

const hostile = { getItem: () => JSON.stringify([{ id: '__proto__', body: 'x', title: 'x' }]) };
const loaded = loadItems(hostile);
assert.equal(loaded.length, 1);
assert.equal(loaded[0].id, '__proto__');
console.log('test-prompt-library-storage: ok');
