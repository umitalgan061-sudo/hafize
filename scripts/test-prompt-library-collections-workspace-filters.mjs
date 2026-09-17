import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');

for (const sort of ['updated-desc', 'name-asc', 'members-desc', 'usage-desc', 'favorite-first']) {
  assert.match(source, new RegExp(`['"]${sort}['"]`));
}
for (const filter of ['all', 'active', 'favorite', 'archived']) {
  assert.match(source, new RegExp(`['"]${filter}['"]`));
}
assert.match(source, /function sortCollections\(collections, workspace\)/);
assert.match(source, /function matchesFilter\(collection, workspace\)/);
assert.match(source, /function matchesQuery\(collection, workspace\)/);
assert.match(source, /function visibleCollections\(workspace\)/);
assert.match(source, /collections\.filter\(\(collection\) => matchesFilter\(collection, workspace\) && matchesQuery\(collection, workspace\)\)/);
assert.match(source, /toLocaleLowerCase\('tr-TR'\)/);
assert.match(source, /localeCompare\(b\.name, 'tr'\)/);
assert.match(source, /members-desc/);
assert.match(source, /usage-desc/);

console.log('prompt collection workspace filters: ok');
