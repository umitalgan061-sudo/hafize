import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../public/typed/prompt-library.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/prompt-library.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
assert.match(js, /aria-labelledby/);
assert.match(js, /aria-label/);
assert.match(js, /role', 'status'/);
assert.match(js, /aria-live/);
assert.match(js, /aria-pressed/);
assert.match(css, /:focus-visible/);
assert.match(css, /forced-colors/);
assert.match(css, /max-width:700px/);
assert.match(html, /prompt-library\.css/);
console.log('test-prompt-library-a11y: ok');
