import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /MAX_COLLECTIONS = 24/);
assert.match(source, /MAX_NAME = 36/);
assert.match(source, /MAX_SELECTED = 40/);
assert.match(source, /MAX_EXPORT = 500_000/);
assert.match(source, /slice\(0, MAX_COLLECTIONS \* 2\)/);
assert.match(source, /slice\(0, 1000\)/);
assert.match(source, /slice\(0, MAX_SELECTED\)/);
assert.match(source, /selected\.size/);
console.log('prompt library collections bounds: ok');
