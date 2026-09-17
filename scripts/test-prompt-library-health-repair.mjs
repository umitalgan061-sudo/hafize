import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(`file://${path.join(root, 'public', 'prompt-library-health.js')}?repair=${Date.now()}`);
const api = globalThis.HafizePromptLibraryHealth;
assert.ok(api);

const previousStorage = globalThis.localStorage;
const previousCore = globalThis.HafizePromptLibrary;
const calls = [];
const data = new Map();
const storage = {
  getItem(key) { return data.get(key) ?? null; },
  setItem(key, value) { calls.push({ key, value }); data.set(key, String(value)); }
};
globalThis.localStorage = storage;
globalThis.HafizePromptLibrary = {
  loadItems(store) { return JSON.parse(store.getItem('hafize.prompt-library.v1') || '[]'); },
  normalizeCollection(items) { return Array.isArray(items) ? items.slice(0, 120) : []; },
  saveItems(store, items) { store.setItem('hafize.prompt-library.v1', JSON.stringify(items)); return true; }
};

data.set('hafize.prompt-library.v1', JSON.stringify([
  { id: 'a', title: 'A', body: 'geçerli prompt', useCount: 0 },
  { id: 'b', title: 'B', body: 'başka prompt', useCount: 2 }
]));

try {
  const before = api.diagnose(globalThis);
  const result = api.repair(globalThis);
  assert.equal(result.ok, true);
  assert.ok(calls.some((entry) => entry.key === 'hafize.prompt-library.v1'));
  const after = api.diagnose(globalThis);
  assert.equal(after.summary.promptCount, before.summary.promptCount);
  assert.ok(after.summary.promptCount <= 120);

  const noStorage = { ...globalThis };
  const current = globalThis.localStorage;
  delete globalThis.localStorage;
  const failed = api.repair(globalThis);
  assert.equal(failed.ok, false);
  globalThis.localStorage = current;
  void noStorage;
} finally {
  if (previousStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousStorage;
  if (previousCore === undefined) delete globalThis.HafizePromptLibrary;
  else globalThis.HafizePromptLibrary = previousCore;
}

console.log('prompt library health repair: ok');
