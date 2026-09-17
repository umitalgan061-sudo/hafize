import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

const limits = {
  selected: Number(source.match(/MAX_SELECTED\s*=\s*(\d+)/)?.[1]),
  query: Number(source.match(/MAX_QUERY\s*=\s*(\d+)/)?.[1]),
  name: Number(source.match(/MAX_NAME\s*=\s*(\d+)/)?.[1]),
  description: Number(source.match(/MAX_DESCRIPTION\s*=\s*(\d+)/)?.[1]),
  memberQuery: Number(source.match(/MAX_MEMBER_QUERY\s*=\s*(\d+)/)?.[1]),
  meta: Number(source.match(/MAX_META_ITEMS\s*=\s*(\d+)/)?.[1]),
  useCount: Number(source.match(/MAX_USE_COUNT\s*=\s*(\d+)/)?.[1])
};

assert.deepEqual(limits, {
  selected: 40,
  query: 100,
  name: 80,
  description: 240,
  memberQuery: 100,
  meta: 40,
  useCount: 9999
});

for (const symbol of [
  'normalizeMeta',
  'normalizeMetaMap',
  'normalizeState',
  'loadWorkspace',
  'saveWorkspace',
  'metaFor',
  'sortCollections',
  'matchesFilter',
  'matchesQuery',
  'membersFor',
  'stats',
  'mutateMeta',
  'markUsed',
  'reorderCollection',
  'deleteCollections',
  'exportWorkspace',
  'importWorkspace'
]) {
  assert.match(source, new RegExp(`function ${symbol}\\b`));
}

assert.match(source, /version:\s*2/);
assert.match(source, /metadataByName/);
assert.match(source, /COLORS\s*=\s*Object\.freeze/);
assert.match(source, /SORTS\s*=\s*Object\.freeze/);
assert.match(source, /FILTERS\s*=\s*Object\.freeze/);
assert.match(source, /Object\.freeze\(\{\s*active:/);

console.log('prompt collection workspace data: ok');
