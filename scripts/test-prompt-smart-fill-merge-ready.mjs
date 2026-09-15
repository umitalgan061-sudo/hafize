import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

const smart = read('public/prompt-library-smart-fill.js');
const insert = read('public/prompt-library-smart-insert.js');
const index = read('public/index.html');

assert.match(smart, /{{/);
assert.match(smart, /maxLength/);
assert.match(smart, /aria-/);
assert.match(smart, /preview/);
assert.doesNotMatch(smart, /fetch\s*\(/);
assert.doesNotMatch(smart, /XMLHttpRequest/);
assert.match(insert, /messageInput/);
assert.doesNotMatch(insert, /\.submit\s*\(/);
assert.doesNotMatch(insert, /fetch\s*\(/);
assert.match(index, /prompt-library-smart-fill\.js/);
assert.match(index, /prompt-library-smart-insert\.js/);

console.log('prompt smart fill merge-ready contracts: ok');
