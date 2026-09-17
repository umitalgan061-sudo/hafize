import assert from 'node:assert/strict';
import fs from 'node:fs';

class Storage {
  #data = new Map();
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null; }
  setItem(key, value) { this.#data.set(key, String(value)); }
  removeItem(key) { this.#data.delete(key); }
  clear() { this.#data.clear(); }
}

const storage = new Storage();
const previous = globalThis.localStorage;
globalThis.localStorage = storage;
delete globalThis.HafizePromptLibraryCollections;
await import(new URL('../public/prompt-library-collections.js', import.meta.url));
const api = globalThis.HafizePromptLibraryCollections;
assert.ok(api);

const promptIds = Array.from({ length: 3 }, (_, index) => `prompt-${index + 1}`);
storage.setItem('hafize.prompt-library.v1', JSON.stringify(promptIds.map((id) => ({ id, title: id, body: `body ${id}` }))));

const created = api.createCollection({ name: 'Yazı işleri', description: 'Metin istemleri' }, storage);
assert.ok(created);
assert.equal(created.promptIds.length, 0);
assert.equal(api.readCollections(storage).length, 1);

const updated = api.updateCollection(created.id, { description: 'Güncel açıklama', promptIds: promptIds }, storage);
assert.ok(updated);
assert.deepEqual(updated.promptIds, promptIds);

assert.equal(api.addMembers(created.id, ['prompt-1', 'prompt-2', 'prompt-3', 'unknown'], storage).promptIds.length, 3);
assert.equal(api.removeMembers(created.id, ['prompt-2'], storage).promptIds.length, 2);
assert.deepEqual(api.setMembership(created.id, ['prompt-3', 'unknown'], storage).promptIds, ['prompt-3']);

const exported = api.exportPayload(storage);
const payload = JSON.parse(exported);
assert.equal(payload.version, 1);
assert.equal(payload.source, 'hafize-prompt-library-collections');
assert.equal(payload.collections.length, 1);

const importedStorage = new Storage();
importedStorage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'prompt-3', title: 'p3', body: 'x' }]));
const imported = api.importPayload(payload, importedStorage);
assert.equal(imported.imported, 1);
assert.equal(api.readCollections(importedStorage)[0].promptIds.length, 1);

storage.setItem('hafize.prompt-library.v1', JSON.stringify([{ id: 'prompt-3', title: 'p3', body: 'x' }]));
const pruned = api.pruneMembers(api.readCollections(storage), storage);
assert.deepEqual(pruned[0].promptIds, ['prompt-3']);

for (let index = 1; index < api.MAX_COLLECTIONS; index += 1) {
  api.createCollection({ name: `Koleksiyon ${index}` }, storage);
}
assert.equal(api.readCollections(storage).length, api.MAX_COLLECTIONS);
assert.equal(api.createCollection({ name: 'fazla' }, storage), null);

const duplicate = api.createCollection({ name: 'Koleksiyon 1' }, storage);
assert.equal(duplicate, null);
assert.equal(api.updateCollection(created.id, { name: 'Koleksiyon 1' }, storage), null);
assert.equal(api.deleteCollection('missing-id', storage), false);
assert.equal(api.deleteCollection(created.id, storage), true);

const hostile = api.normalizeCollection({
  name: '  güvenli  ',
  description: '<img src=x onerror=alert(1)>',
  promptIds: [1, 'ok', 'ok'],
  id: { toString() { throw new Error('must not be coerced'); } }
});
assert.ok(hostile);
assert.equal(hostile.name, 'güvenli');
assert.equal(hostile.promptIds.length, 1);
assert.equal(hostile.promptIds[0], 'ok');
assert.doesNotMatch(fs.readFileSync('public/prompt-library-collections.js', 'utf8'), /innerHTML\s*=/);

globalThis.localStorage = previous;
console.log('prompt library collections runtime: ok');
