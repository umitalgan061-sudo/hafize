import assert from 'node:assert/strict';
import fs from 'node:fs';

class Storage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

const storage = new Storage();
globalThis.localStorage = storage;
await import(new URL('../public/prompt-library-revisions.js', import.meta.url));
const api = globalThis.HafizePromptLibraryRevisions;
assert.ok(api);

const prompt = { id: 'p1', title: 'Özet', body: 'Konu: {{konu}}', tags: ['metin'], favorite: false, useCount: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };
storage.setItem(api.PROMPT_KEY, JSON.stringify([prompt]));
assert.equal(api.capture(prompt, 'create', storage), true);
assert.equal(api.capture(prompt, 'edit', storage), false);
assert.equal(api.revisionsFor('p1', storage).length, 1);

const edited = { ...prompt, body: 'Konu: {{konu}} için kısa özet', updatedAt: '2026-01-03T00:00:00.000Z' };
assert.equal(api.capture(edited, 'edit', storage), true);
assert.equal(api.revisionsFor('p1', storage).length, 2);

const history = api.revisionsFor('p1', storage);
assert.equal(history[0].promptId, 'p1');
assert.equal(history[0].snapshot.id, 'p1');
assert.ok(history[0].createdAt);
assert.equal(api.summarizeRevision(history[0]).promptId, 'p1');

const exported = JSON.parse(api.exportPromptRevisions('p1', storage));
assert.equal(exported.version, 1);
assert.equal(exported.promptId, 'p1');
assert.equal(exported.revisions.length, 2);

const restored = api.restore('p1', history[1].id, storage);
assert.ok(restored);
assert.equal(restored.id, 'p1');
assert.equal(restored.createdAt, prompt.createdAt);
assert.equal(restored.useCount, prompt.useCount);
assert.equal(JSON.parse(storage.getItem(api.PROMPT_KEY))[0].body, history[1].snapshot.body);
assert.ok(api.revisionsFor('p1', storage).some((item) => item.reason === 'before-restore'));

assert.equal(api.restore('missing', history[0].id, storage), null);
assert.equal(api.removePromptRevisions('missing', storage), true);
assert.equal(api.removePromptRevisions('p1', storage), true);
assert.equal(api.revisionsFor('p1', storage).length, 0);

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(source, /MAX_REVISIONS_PER_PROMPT = 20/);
assert.match(source, /MAX_REVISIONS_TOTAL = 600/);
assert.match(source, /before-restore/);
assert.match(source, /restore/);
assert.match(source, /pruneOrphans/);
assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /fetch\s*\(/);
console.log('prompt library revisions runtime: ok');
