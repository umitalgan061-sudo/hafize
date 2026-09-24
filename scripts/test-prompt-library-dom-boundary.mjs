import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/typed/prompt-library.ts', import.meta.url), 'utf8');
assert.match(source, /function element\(/);
assert.match(source, /textContent =/);
assert.match(source, /row\.dataset\.promptId/);
assert.match(source, /setAttribute\('aria-label'/);
assert.doesNotMatch(source, /\.outerHTML/);
assert.match(source, /card\.append\(/);
assert.match(source, /replaceChildren\(\)/);
console.log('test-prompt-library-dom-boundary: ok');
