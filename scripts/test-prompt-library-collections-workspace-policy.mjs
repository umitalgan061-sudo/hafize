import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

assert.match(source, /hafize\.prompt-library\.collections-workspace\.v1/);
assert.match(source, /MAX_SELECTED\s*=\s*40/);
assert.match(source, /MAX_QUERY\s*=\s*100/);
assert.match(source, /MAX_NAME\s*=\s*80/);
assert.match(source, /MAX_DESCRIPTION\s*=\s*240/);
assert.match(source, /MAX_IMPORT_BYTES\s*=\s*500_000/);
assert.match(source, /MAX_EXPORT_BYTES\s*=\s*750_000/);
assert.match(source, /MAX_META_ITEMS\s*=\s*40/);
assert.match(source, /MAX_USE_COUNT\s*=\s*9999/);
assert.match(source, /WORKSPACE_KEY/);
assert.match(source, /normalizeState/);
assert.match(source, /normalizeMetaMap/);
assert.match(source, /normalizeMeta/);
assert.match(source, /saveWorkspace/);
assert.match(source, /loadWorkspace/);
assert.match(source, /visibleCollections/);
assert.match(source, /exportWorkspace/);
assert.match(source, /importWorkspace/);
assert.equal(source.includes('fetch('), false, 'collection workspace must not call remote fetch');
assert.equal(source.includes('XMLHttpRequest'), false);
assert.equal(source.includes('navigator.sendBeacon'), false);
assert.equal(source.includes('WebSocket'), false);

const forbidden = [
  /process\.env/,
  /document\.cookie/,
  /authorization\s*:/i,
  /Bearer\s+/i
];
for (const pattern of forbidden) assert.equal(pattern.test(source), false, String(pattern));

console.log('prompt collection workspace policy: ok');
