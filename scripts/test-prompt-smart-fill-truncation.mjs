import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /MAX_VALUE = 1000/);
assert.match(source, /MAX_BODY = 8000/);
assert.match(source, /slice\(0, MAX_VALUE\)/);
assert.match(source, /slice\(0, MAX_BODY\)/);
assert.match(source, /\.slice\(0, 12000\)/);

console.log('smart-fill truncation boundaries: ok');
