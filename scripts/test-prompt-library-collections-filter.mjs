import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /let activeFilter = ALL/);
assert.match(source, /function applyFilterVisibility/);
assert.match(source, /collectionMatches\(map, promptId, activeFilter\)/);
assert.match(source, /row\.hidden/);
assert.match(source, /Tüm koleksiyonlar/);
assert.match(source, /Koleksiyonsuz/);
assert.match(source, /hafize:prompt-library-collection-filter/);
console.log('prompt library collections filter: ok');
