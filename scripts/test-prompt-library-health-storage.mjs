import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import(`file://${path.join(root, 'public', 'prompt-library-health.js')}?storage=${Date.now()}`);
const api = globalThis.HafizePromptLibraryHealth;
assert.ok(api);

const broken = {
  getItem() { throw new Error('read failure'); },
  setItem() { throw new Error('write failure'); }
};
const previous = globalThis.localStorage;
globalThis.localStorage = broken;
try {
  const report = api.diagnose(globalThis);
  assert.equal(report.summary.promptCount, 0);
  assert.equal(report.summary.collectionCount, 0);
  assert.equal(report.summary.revisionCount, 0);
  const repair = api.repair(globalThis);
  assert.equal(repair.ok, false);
} finally {
  if (previous === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previous;
}

console.log('prompt library health storage: ok');
