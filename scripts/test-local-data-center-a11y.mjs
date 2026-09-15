import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/local-data-center.js', 'utf8');
const css = fs.readFileSync('public/local-data-center.css', 'utf8');
assert.match(source, /aria-labelledby/);
assert.match(source, /aria-live/);
assert.match(source, /role', 'list'/);
assert.match(source, /role.*listitem/);
assert.match(source, /aria-label/);
assert.match(source, /focus\(\)/);
assert.match(css, /focus-visible/);
assert.match(css, /forced-colors/);
assert.match(css, /prefers-reduced-motion/);
console.log('local data center accessibility: ok');
