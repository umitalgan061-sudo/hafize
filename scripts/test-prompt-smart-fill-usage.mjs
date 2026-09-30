import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /useCount/);
assert.match(source, /useCount\) \+ 1/);
assert.match(source, /hafize\.prompt-library/);
assert.match(source, /StorageEvent/);
assert.match(source, /updatedAt/);

console.log('smart-fill usage accounting: ok');
