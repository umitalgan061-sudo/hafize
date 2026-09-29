import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

for (const token of [
  'getCollectionForPrompt',
  'collectionMatches',
  'pruneMap',
  'normalizeImported',
  'mergeImported',
  'exportPayload',
  'getDefaultCollection'
]) {
  assert.ok(source.includes(token), `missing runtime helper: ${token}`);
}

assert.match(source, /return Object\.freeze\(\{/);
console.log('prompt library collections runtime contract: ok');
