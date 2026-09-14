import assert from 'node:assert/strict';
import fs from 'node:fs';

const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const css = fs.readFileSync('public/prompt-library.css', 'utf8');

assert.match(usage, /aria-labelledby/);
assert.match(usage, /promptLibraryUsageTitle/);
assert.match(usage, /aria-expanded/);
assert.match(usage, /setAttribute\('aria-expanded'/);
assert.match(usage, /role', 'list'/);
assert.match(usage, /role', 'listitem'/);
assert.match(usage, /textContent = String\(value/);
assert.match(css, /:focus-visible/);
assert.match(css, /forced-colors:active/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(css, /prompt-library-usage-stats/);
assert.match(css, /grid-template-columns:1fr/);
assert.doesNotMatch(usage, /role="presentation"/);
assert.doesNotMatch(usage, /tabindex="-1"/);

console.log('prompt-library usage accessibility contracts: ok');
