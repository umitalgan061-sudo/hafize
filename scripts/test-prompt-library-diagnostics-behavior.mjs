// The health check, run against real stores.
//
// `scan()` reads the three local stores and `repair()` rewrites them, so both are
// exercised here against a fake `localStorage`: a diagnostics panel that reports
// a clean library while prompts are missing would be worse than none at all.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
// The collections module installs itself on the global instead of exporting, so
// it is read back from there the same way the page reads it.
require('../public/prompt-library-collections.js');
const collections = globalThis.HafizePromptLibraryCollections;
const diagnostics = require('../public/prompt-library-diagnostics.js');
assert.ok(collections?.normalizeCollection, 'the collections module is installed');

function createStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); }
  };
}

const prompt = (id, title, body = 'gövde metni') => ({
  id,
  title,
  body,
  tags: [],
  variables: [],
  favorite: false,
  useCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

const findingIds = (report) => report.findings.map((finding) => finding.id);

/* A healthy library reports nothing and offers no repair ------------------ */

const healthy = createStore({
  [diagnostics.PROMPT_KEY]: JSON.stringify([prompt('a', 'Bir'), prompt('b', 'İki')])
});
const healthyReport = diagnostics.scan(healthy);
assert.deepEqual(healthyReport.findings, []);
assert.equal(healthyReport.prompts, 2);
assert.equal(healthyReport.repairable, false);

/* An empty browser is healthy too, not broken ----------------------------- */

assert.deepEqual(diagnostics.scan(createStore()).findings, []);
assert.equal(diagnostics.scan(null).prompts, 0);

/* Unreadable stores are named one by one ---------------------------------- */

const broken = createStore({
  [diagnostics.PROMPT_KEY]: '{not json',
  [diagnostics.COLLECTION_KEY]: '[[[',
  [diagnostics.REVISION_KEY]: '}'
});
assert.deepEqual(findingIds(diagnostics.scan(broken)), ['prompts-unreadable', 'collections-unreadable', 'revisions-unreadable']);

/* Broken and duplicated records are separate findings --------------------- */

const damaged = createStore({
  [diagnostics.PROMPT_KEY]: JSON.stringify([
    prompt('a', 'Sağlam'),
    { id: 'b', title: 'Gövdesiz' },
    prompt('a', 'Aynı kimlik'),
    null
  ])
});
const damagedReport = diagnostics.scan(damaged);
assert.deepEqual(findingIds(damagedReport), ['invalid-prompts', 'duplicate-prompts']);
assert.equal(damagedReport.repairable, true);
assert.equal(damagedReport.valid.length, 2);
assert.ok(damagedReport.findings[0].label.startsWith('2 istem'));

/* Repair keeps what the library can read and drops the rest --------------- */

assert.equal(diagnostics.repair(damagedReport, damaged), true);
const afterRepair = diagnostics.scan(damaged);
assert.deepEqual(afterRepair.findings, []);
// The unreadable records are gone and the duplicated id is collapsed into the
// first prompt that carried it, which is what the library would have shown.
assert.equal(afterRepair.prompts, 1);
assert.equal(library.loadItems(damaged).length, 1);
assert.equal(library.loadItems(damaged)[0].title, 'Sağlam');

/* A collection pointing at a deleted prompt is an orphan, and repairable --- */

const orphaned = createStore({
  [diagnostics.PROMPT_KEY]: JSON.stringify([prompt('a', 'Duran')]),
  [diagnostics.COLLECTION_KEY]: JSON.stringify([
    { id: 'c1', name: 'Koleksiyon', description: '', color: 'sand', promptIds: ['a', 'silinmis'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
  ])
});
const orphanReport = diagnostics.scan(orphaned);
assert.deepEqual(findingIds(orphanReport), ['orphan-members']);
assert.equal(orphanReport.repairable, true);
assert.ok(orphanReport.findings[0].detail[0].includes('silinmis'));
assert.equal(diagnostics.repair(orphanReport, orphaned), true);
assert.deepEqual(diagnostics.scan(orphaned).findings, []);
assert.deepEqual(collections.readCollections(orphaned)[0].promptIds, ['a']);

/* Repair never runs without somewhere to write ---------------------------- */

assert.equal(diagnostics.repair(orphanReport, null), false);
assert.equal(diagnostics.repair(null, createStore()), true);

/* The orphan list is bounded ---------------------------------------------- */

const manyOrphans = createStore({
  [diagnostics.PROMPT_KEY]: JSON.stringify([]),
  [diagnostics.COLLECTION_KEY]: JSON.stringify([
    {
      id: 'c1',
      name: 'Büyük',
      description: '',
      color: 'sand',
      promptIds: Array.from({ length: 200 }, (_, index) => `yok-${index}`),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ])
});
const boundedReport = diagnostics.scan(manyOrphans);
const orphanFinding = boundedReport.findings.find((finding) => finding.id === 'orphan-members');
assert.ok(orphanFinding);
assert.ok(orphanFinding.detail.length <= 12);
assert.ok(orphanFinding.label.startsWith(`${diagnostics.MAX_ORPHANS} `));

/* The scan itself never writes -------------------------------------------- */

const readOnly = createStore({ [diagnostics.PROMPT_KEY]: '{not json' });
const before = JSON.stringify([...readOnly.data]);
diagnostics.scan(readOnly);
assert.equal(JSON.stringify([...readOnly.data]), before);

console.log('prompt library diagnostics behaviour: findings, bounds and repair verified on real stores');
