import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/prompt-library.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/prompt-library.css', import.meta.url), 'utf8');
assert.match(source, /aria-labelledby/);
assert.match(source, /aria-label/);
assert.match(source, /aria-live/);
assert.match(source, /aria-pressed/);
assert.match(css, /:focus-visible/);
assert.match(css, /forced-colors/);
assert.match(css, /max-width:700px/);
console.log('test-prompt-library-a11y: ok');
