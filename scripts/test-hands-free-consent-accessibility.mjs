import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/hands-free-consent.css', import.meta.url), 'utf8');

assert.match(js, /role', 'group'/);
assert.match(js, /aria-label', 'Eller serbest mikrofon izni'/);
assert.match(js, /review\.confirm\.focus\?\.\(\)/);
assert.match(js, /toggle\.focus\?\.\(\)/);
assert.match(js, /event\?\.key !== 'Escape'/);
assert.match(js, /aria-describedby/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /forced-colors:\s*active/);
assert.match(css, /grid-template-columns:\s*1fr/);
assert.doesNotMatch(js, /autofocus/i);
assert.doesNotMatch(js, /tabindex\s*=\s*['"]-1/);

console.log('hands-free consent accessibility tests passed');
