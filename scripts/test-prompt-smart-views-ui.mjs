import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-smart-views.js','utf8');
assert.match(source,/setAttribute\('role', 'list'\)/);
assert.match(source,/setAttribute\('role', 'listitem'\)/);
assert.match(source,/aria-labelledby/);
assert.match(source,/aria-live/);
assert.match(source,/aria-expanded/);
assert.match(source,/textContent/);
assert.doesNotMatch(source,/\.innerHTML\s*=/);
console.log('smart-view ui boundary: ok');