import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile('public/prompt-library-safety.js', 'utf8');
const map = new Map();
const storage = {
  getItem(key) { return map.has(key) ? map.get(key) : null; },
  setItem(key, value) { map.set(key, String(value)); },
  removeItem(key) { map.delete(key); }
};
let idCounter = 0;
const root = {
  localStorage: storage,
  crypto: { randomUUID: () => 'generated-' + (++idCounter) },
  CustomEvent: class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.key = init.key || ''; }
  },
  dispatchEvent() {}
};

function normalizeItem(item) {
  if (!item || typeof item !== 'object' || typeof item.body !== 'string' || !item.body) return null;
  return {
    id: typeof item.id === 'string' && item.id ? item.id : 'item-' + (++idCounter),
    title: typeof item.title === 'string' && item.title ? item.title : 'İsimsiz istem',
    body: item.body.slice(0, 8000),
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
    variables: Array.isArray(item.variables) ? item.variables.slice(0, 12) : [],
    favorite: item.favorite === true,
    useCount: Number.isFinite(item.useCount) && item.useCount >= 0 ? Math.floor(item.useCount) : 0,
    createdAt: item.createdAt || '2026-01-01T00:00:00.000Z',
    updatedAt: item.updatedAt || '2026-01-01T00:00:00.000Z'
  };
}
const normalizeCollection = (items) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).map(normalizeItem).filter(Boolean).filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 120);
};
root.HafizePromptLibrary = {
  normalizeItem,
  normalizeCollection,
  loadItems(s) { const raw = s.getItem('hafize.prompt-library.v1'); return normalizeCollection(raw ? JSON.parse(raw) : []); },
  saveItems(s, items) { s.setItem('hafize.prompt-library.v1', JSON.stringify(normalizeCollection(items))); return true; },
  mergeImportedItems(current, incoming) {
    const result = normalizeCollection(current);
    const ids = new Set(result.map((item) => item.id));
    let imported = 0;
    for (const raw of incoming || []) {
      let item = normalizeItem(raw);
      if (!item) continue;
      while (ids.has(item.id)) item = { ...item, id: 'generated-' + (++idCounter) };
      ids.add(item.id);
      result.push(item);
      imported += 1;
      if (result.length >= 120) break;
    }
    return { items: normalizeCollection(result), imported };
  }
};
root.HafizePromptLibraryCollections = {
  normalizeCollections: normalizeCollection,
  pruneMembers(items, s) {
    const ids = new Set(root.HafizePromptLibrary.loadItems(s).map((item) => item.id));
    return normalizeCollection(items).map((item) => ({ ...item, promptIds: (item.promptIds || []).filter((id) => ids.has(id)) }));
  },
  readCollections(s) { const raw = s.getItem('hafize.prompt-library.collections.v1'); return raw ? JSON.parse(raw) : []; },
  saveCollections(s, items) { s.setItem('hafize.prompt-library.collections.v1', JSON.stringify(items)); return true; }
};
root.HafizePromptLibraryRevisions = {
  readRevisions(s) { const raw = s.getItem('hafize.prompt-library.revisions.v1'); return raw ? JSON.parse(raw) : []; },
  saveRevisions(s, items) { s.setItem('hafize.prompt-library.revisions.v1', JSON.stringify(items)); return true; }
};

vm.runInNewContext(source, root);
const api = root.HafizePromptLibrarySafety;
assert.ok(api);

const current = [normalizeItem({ id: 'same', title: 'Mevcut', body: 'mevcut' })];
const plan = api.buildImportPlan({
  version: 1,
  items: [
    { id: 'same', title: 'Yeni', body: 'yeni' },
    { id: 'same', title: 'İkinci', body: 'ikinci' },
    { id: 'bad', title: 'Boş', body: '' }
  ]
}, current);
assert.equal(plan.sourceCount, 3);
assert.equal(plan.validCount, 2);
assert.equal(plan.invalidCount, 1);
assert.equal(plan.acceptedCount, 2);
assert.ok(plan.collisions >= 1);

api.saveItems(storage, current);
const applied = api.applyImportPlan(plan, storage);
assert.equal(applied.ok, true);
assert.equal(root.HafizePromptLibrary.loadItems(storage).length, 3);

const quarantine = api.quarantineInvalidItems(storage, [1]);
assert.equal(quarantine.ok, true);
assert.ok(api.readQuarantine(storage).items.length >= 1);

assert.equal(api.createRepairCheckpoint(storage), true);
assert.equal(api.hasRepairCheckpoint(storage), true);
const repaired = api.applySafeRepair(storage);
assert.equal(repaired.ok, true);
assert.equal(api.hasRepairCheckpoint(storage), true);
const undone = api.undoLastRepair(storage);
assert.equal(undone.ok, true);
assert.equal(api.hasRepairCheckpoint(storage), false);

console.log('prompt-library-safety-behavior: ok');
