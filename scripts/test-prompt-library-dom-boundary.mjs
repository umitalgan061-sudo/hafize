import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library.js', import.meta.url), 'utf8');
assert.match(source, /card\.innerHTML\s*=\s*\[/);
assert.doesNotMatch(source, /innerHTML\s*=\s*[^\[]*\$\{/);
assert.match(source, /textContent/);
assert.match(source, /createElement/);
assert.match(source, /setAttribute\('aria-label'/);
assert.match(source, /textarea\.value/);
assert.match(source, /replaceChildren/);
console.log('test-prompt-library-dom-boundary: ok');
