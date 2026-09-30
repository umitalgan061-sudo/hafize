import assert from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill-hints.js', 'utf8');

assert.match(source, /smartFillHint/);
assert.match(source, /değişken/);
assert.match(source, /MutationObserver/);
assert.match(source, /extractVariables/);
assert.doesNotMatch(source, /innerHTML/);

console.log('smart-fill discovery hints: ok');
