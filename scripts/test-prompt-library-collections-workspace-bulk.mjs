import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

for (const action of ['bulk-favorite', 'bulk-archive', 'bulk-unarchive', 'bulk-delete', 'clear-selection']) {
  assert.match(source, new RegExp(`['"]${action}['"]`), `missing ${action}`);
}
assert.match(source, /selectedIds\(\)/);
assert.match(source, /MAX_SELECTED/);
assert.match(source, /new Set\(ids\.slice\(0, MAX_SELECTED\)\)/);
assert.match(source, /`${ids\.length} koleksiyon silinsin mi\?`/);
assert.match(source, /deleteCollections\(ids, workspace\)/);
assert.match(source, /selectedIds:\s*workspace\.state\.selectedIds\.filter/);
assert.match(source, /activeId:\s*selected\.has\(workspace\.state\.activeId\) \? ''/);
assert.match(source, /mutateMeta\(workspace, selectedIds\(\), patch\)/);

console.log('prompt collection workspace bulk: ok');
