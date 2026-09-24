import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/connector-hub.js', 'utf8');
const css = await readFile('public/connector-hub.css', 'utf8');

assert.match(source, /aria-labelledby/);
assert.match(source, /aria-expanded/);
assert.match(source, /aria-controls/);
assert.match(source, /type = ['"]button['"]/);
assert.match(source, /focus-visible/);
assert.match(source, /textContent/);
assert.match(css, /:focus-visible/);
assert.match(css, /max-width:700px/);
assert.match(source, /Oturum gerekli/);
assert.match(source, /Bağlı değil/);
assert.match(source, /Devre dışı/);
assert.match(source, /Hazır/);
assert.match(source, /refresh\.disabled/);

console.log('connector hub accessibility: passed');