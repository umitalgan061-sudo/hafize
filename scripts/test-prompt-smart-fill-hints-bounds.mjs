import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill-hints.js', 'utf8');

assert.match(source, /MAX_VARIABLES = 12/);
assert.match(source, /slice\(0, MAX_VARIABLES\)/);
assert.match(source, /data-smart-fill-hint/);
assert.match(source, /prompt-item-tag/);
assert.match(source, /textContent/);
assert.doesNotMatch(source, /innerHTML/);
assert.doesNotMatch(source, /fetch\s*\(/);

console.log('smart-fill discovery bounds: ok');
