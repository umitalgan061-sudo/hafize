import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');
const css = fs.readFileSync('public/prompt-library-collections-workspace.css', 'utf8');

assert.match(source, /role', 'dialog'/);
assert.match(source, /aria-modal/);
assert.match(source, /aria-labelledby/);
assert.match(source, /aria-live/);
assert.match(source, /role', 'list'/);
assert.match(source, /role', 'listitem'/);
assert.match(source, /setAttribute\('aria-label'/);
assert.match(source, /tabIndex\s*=\s*0/);
assert.match(source, /trapDialogTab/);
assert.match(source, /lastFocus/);
assert.match(source, /lastFocus\.focus\(\)/);
assert.match(source, /prefers-reduced-motion/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
assert.match(css, /focus-visible/);
assert.match(css, /max-width:700px/);

assert.equal(source.includes('innerHTML'), false, 'dynamic content must not use innerHTML');
assert.equal(source.includes('outerHTML'), false, 'dynamic content must not use outerHTML');
assert.match(source, /textContent\s*=/);
assert.match(source, /createElement\(/);
assert.match(source, /replaceChildren\(\)/);

console.log('prompt collection workspace accessibility: ok');
