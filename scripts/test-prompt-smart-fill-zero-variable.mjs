import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /if \(!names\.length\)/);
assert.match(source, /Bu istem değişken içermiyor/);
assert.match(source, /insert\.focus/);
assert.match(source, /activePrompt\.body/);

console.log('smart-fill zero-variable behavior: ok');
