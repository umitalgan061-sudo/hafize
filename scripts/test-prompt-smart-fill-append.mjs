import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /insertMode/);
assert.match(source, /replaceMode/);
assert.match(source, /appendMode/);
assert.match(source, /Mesajın sonuna ekle/);
assert.match(source, /existing.*composer\.value/);
assert.match(source, /\\n\\n\$\{message\}/);

console.log('smart-fill append mode: ok');
