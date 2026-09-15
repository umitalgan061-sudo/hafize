import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(s, /event\.key === 'Escape'/);
assert.match(s, /event\.key !== 'Tab'/);
assert.match(s, /event\.shiftKey/);
assert.match(s, /first\.focus\(\)/);
assert.match(s, /last\.focus\(\)/);
console.log('revision keyboard navigation: ok');
