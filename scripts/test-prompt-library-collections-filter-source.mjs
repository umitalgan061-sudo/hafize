import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /function collectionMatches/);
assert.match(source, /filterId === NONE/);
assert.match(source, /assigned === NONE/);
assert.match(source, /assigned === filterId/);
assert.match(source, /row\.hidden = !collectionMatches/);
assert.match(source, /activeFilter !== ALL/);
console.log('prompt library collections filter source contract: ok');
