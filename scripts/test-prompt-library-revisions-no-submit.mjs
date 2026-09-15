import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.doesNotMatch(s, /form\.submit/);
assert.doesNotMatch(s, /\.requestSubmit/);
assert.doesNotMatch(s, /#composer/);
assert.match(s, /restore\(revision\)/);
assert.match(s, /api\.saveItems/);
console.log('revision no-submit boundary: ok');
