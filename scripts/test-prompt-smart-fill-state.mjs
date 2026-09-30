import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /MAX_PRESETS = 8/);
assert.match(source, /MAX_NAME = 60/);
assert.match(source, /MAX_VARIABLES = 12/);
assert.match(source, /MAX_VALUE = 1000/);
assert.match(source, /readPresets/);
assert.match(source, /writePresets/);
assert.match(source, /readLast/);
assert.match(source, /writeLast/);
assert.match(source, /slice\(0, MAX_VARIABLES\)/);

console.log('smart-fill state bounds: ok');
