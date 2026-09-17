import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const healthPath = path.join(root, 'public', 'prompt-library-health.js');

class MemoryStorage {
  #data = new Map();
  getItem(key) { return this.#data.has(key) ? this.#data.get(key) : null; }
  setItem(key, value) { this.#data.set(key, String(value)); }
  removeItem(key) { this.#data.delete(key); }
}

const previousStorage = globalThis.localStorage;
const storage = new MemoryStorage();
globalThis.localStorage = storage;
await import(`file://${healthPath}?health-core=${Date.now()}`);

try {
  const api = globalThis.HafizePromptLibraryHealth;
  assert.ok(api);
  assert.equal(api.LIMITS.MAX_PROMPTS, 120);
  assert.equal(api.LIMITS.MAX_COLLECTIONS, 40);
  assert.equal(api.LIMITS.MAX_REVISIONS, 600);
  assert.equal(api.LIMITS.MAX_ISSUES, 240);

  let report = api.diagnose(globalThis);
  assert.equal(report.summary.promptCount, 0);
  assert.equal(report.summary.collectionCount, 0);
  assert.equal(report.summary.revisionCount, 0);

  storage.setItem('hafize.prompt-library.v1', JSON.stringify([
    { id: 'a', title: 'Kod inceleme', body: 'Kodumu incele ve riskleri çıkar', tags: [], useCount: 0 },
    { id: 'a', title: 'Kod inceleme', body: 'Kodumu incele ve riskleri çıkar', tags: [], useCount: 0 },
    { id: 'b', title: 'Uzun', body: 'x'.repeat(7000), tags: ['kod'], useCount: 0 }
  ]));

  report = api.diagnose(globalThis);
  assert.equal(report.summary.promptCount, 3);
  assert.equal(report.summary.duplicatePromptIds, 1);
  assert.ok(report.issues.some((issue) => issue.code === 'duplicate-id'));
  assert.ok(report.issues.some((issue) => issue.code === 'duplicate-title'));
  assert.ok(report.issues.some((issue) => issue.code === 'duplicate-body'));
  assert.ok(report.issues.some((issue) => issue.code === 'missing-tags'));
  assert.ok(report.issues.some((issue) => issue.code === 'long-body'));

  storage.setItem('hafize.prompt-library.collections.v1', JSON.stringify([
    { id: 'c1', name: 'Kod', promptIds: ['a', 'ghost'] },
    { id: 'c1', name: 'Kod 2', promptIds: [] }
  ]));
  storage.setItem('hafize.prompt-library.revisions.v1', JSON.stringify([
    { id: 'r1', promptId: 'ghost' },
    { id: 'r1', promptId: 'a' }
  ]));

  report = api.diagnose(globalThis);
  assert.ok(report.issues.some((issue) => issue.code === 'orphan-member'));
  assert.ok(report.issues.some((issue) => issue.code === 'duplicate-collection-id'));
  assert.ok(report.issues.some((issue) => issue.code === 'orphan-revision'));
  assert.equal(report.summary.healthy, false);

  storage.setItem('hafize.prompt-library.v1', '{invalid');
  report = api.diagnose(globalThis);
  assert.ok(report.issues.some((issue) => issue.code === 'storage-root'));
  assert.equal(report.summary.healthy, false);

  console.log('prompt library health core: ok');
} finally {
  if (previousStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousStorage;
}
