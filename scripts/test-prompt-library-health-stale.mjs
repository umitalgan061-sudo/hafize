import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(`file://${path.join(root, 'public', 'prompt-library-health.js')}?stale=${Date.now()}`);
const api = globalThis.HafizePromptLibraryHealth;
assert.ok(api);
assert.equal(api.LIMITS.STALE_DAYS, 180);

const oldNow = Date.now;
const previousStorage = globalThis.localStorage;
const now = Date.parse('2026-09-17T00:00:00.000Z');
Date.now = () => now;
const data = new Map();
globalThis.localStorage = { getItem: (key) => data.get(key) ?? null };

try {
  const oneDay = 86400000;
  const make = (id, days) => ({ id, title: id, body: 'prompt', tags: ['x'], useCount: 1, updatedAt: new Date(now - days * oneDay).toISOString() });
  data.set('hafize.prompt-library.v1', JSON.stringify([make('fresh', 179), make('stale', 180)]));
  const report = api.diagnose(globalThis);
  const stale = report.issues.filter((issue) => issue.code === 'stale').map((issue) => issue.promptId);
  assert.equal(stale.includes('fresh'), false);
  assert.equal(stale.includes('stale'), true);
} finally {
  Date.now = oldNow;
  if (previousStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousStorage;
}
console.log('prompt library health stale: ok');
