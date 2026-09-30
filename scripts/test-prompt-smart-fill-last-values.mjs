import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /lastKey/);
assert.match(source, /readLast/);
assert.match(source, /writeLast/);
assert.match(source, /Son değerler/);
assert.match(source, /writeLast\(activePrompt\.id, current\)/);
assert.match(source, /MAX_VALUE = 1000/);

console.log('smart-fill last values: ok');
