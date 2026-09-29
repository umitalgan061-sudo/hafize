import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /id = 'promptLibraryCollections'/);
assert.match(source, /id = 'promptLibraryCollectionFilter'/);
assert.match(source, /id = 'promptLibraryCollectionBulkDestination'/);
assert.match(source, /id = 'promptLibraryCollectionDefault'/);
assert.match(source, /prompt-library-collection-assignment/);
assert.match(source, /role', 'list'/);
assert.match(source, /role', 'listitem'/);
assert.match(source, /aria-labelledby/);
console.log('prompt library collections UI contract: ok');
