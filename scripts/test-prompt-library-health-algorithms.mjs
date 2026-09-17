import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(`file://${path.join(root, 'public', 'prompt-library-health.js')}?algorithms=${Date.now()}`);
const api = globalThis.HafizePromptLibraryHealth;
assert.ok(api);

assert.equal(api.similarity('kod inceleme risk analizi', 'kod inceleme güvenlik risk analizi') > 0.5, true);
assert.equal(api.similarity('', 'abc'), 0);
assert.equal(api.similarity('bir iki üç', 'tamamen farklı kelimeler'), 0);
assert.ok(api.LIMITS.LONG_BODY >= 7000);
assert.ok(api.LIMITS.STALE_DAYS >= 180);

const previous = globalThis.localStorage;
const data = new Map([
  ['hafize.prompt-library.v1', JSON.stringify([
    { id: '1', title: 'A', body: 'Kod incele riskleri çıkar', tags: ['kod'], useCount: 1, updatedAt: new Date().toISOString() },
    { id: '2', title: 'B', body: 'Kod incele riskleri çıkar', tags: ['kod'], useCount: 1, updatedAt: new Date().toISOString() },
    { id: '3', title: 'C', body: 'Kod incele riskleri çıkar güvenlik kontrolü', tags: [], useCount: 0, updatedAt: new Date().toISOString() }
  ])]
]);
globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };

try {
  const report = api.diagnose(globalThis);
  assert.equal(report.summary.promptCount, 3);
  assert.ok(report.issues.some((issue) => issue.code === 'duplicate-body'));
  assert.ok(report.issues.some((issue) => issue.code === 'near-duplicate'));
  assert.ok(report.issues.some((issue) => issue.code === 'missing-tags'));
  assert.ok(report.issues.some((issue) => issue.code === 'unused'));
} finally {
  if (previous === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previous;
}

console.log('prompt library health algorithms: ok');
