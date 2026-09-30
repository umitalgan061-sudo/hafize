import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile('public/index.html', 'utf8');
const smart = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(index, /prompt-library-smart-fill\.css/);
assert.match(index, /prompt-library-smart-fill\.js/);
assert.match(index, /prompt-library-smart-fill-hints\.js/);
assert.match(index, /prompt-library-usage\.js/);
assert.match(smart, /promptLibraryCard/);
assert.match(smart, /messageInput/);

console.log('smart-fill integration contract: ok');
