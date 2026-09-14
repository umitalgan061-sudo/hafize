import assert from 'node:assert/strict';
import { loadItems, loadState, saveItems, saveState, STORAGE_KEY, STATE_KEY, normalizeItem } from '../public/prompt-library.js';

const data = new Map();
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value)
};
const item = normalizeItem({ id: 'a', title: 'A', body: 'B' });
assert.equal(saveItems(storage, [item]), true);
assert.equal(JSON.parse(data.get(STORAGE_KEY)).length, 1);
assert.equal(loadItems(storage)[0].id, 'a');
const state = { query: 'kod', tag: 'all', favoriteOnly: true, sort: 'updated-desc' };
assert.equal(saveState(storage, state), true);
assert.equal(loadState(storage).query, 'kod');
assert.ok(data.has(STATE_KEY));
const broken = { getItem: () => '{broken', setItem: () => { throw new Error('quota'); } };
assert.deepEqual(loadItems(broken), []);
assert.deepEqual(loadState(broken), { query: '', tag: 'all', favoriteOnly: false, sort: 'updated-desc' });
assert.equal(saveItems(broken, [item]), false);
console.log('test-prompt-library-storage: ok');
