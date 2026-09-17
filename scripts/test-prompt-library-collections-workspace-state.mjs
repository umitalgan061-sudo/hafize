import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

assert.match(source, /const DEFAULT_STATE = Object\.freeze/);
for (const key of ['query', 'memberQuery', 'sort', 'filter', 'activeId', 'selectedIds', 'hidden']) {
  assert.match(source, new RegExp(`\\b${key}\\b`));
}
assert.match(source, /normalizeState\(input, collections = readCollections\(\)\)/);
assert.match(source, /SORTS\.includes\(source\.sort\)/);
assert.match(source, /FILTERS\.includes\(source\.filter\)/);
assert.match(source, /selectedIds\.filter/);
assert.match(source, /slice\(0, MAX_SELECTED\)/);
assert.match(source, /ids\.has\(source\.activeId\)/);
assert.match(source, /version: 2/);
assert.match(source, /saveWorkspace\(workspace\)/);
assert.match(source, /workspace = loadWorkspace\(\)/);
assert.match(source, /WORKSPACE_KEY/);

console.log('prompt collection workspace state: ok');
