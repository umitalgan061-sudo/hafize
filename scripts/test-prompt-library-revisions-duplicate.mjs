import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(s, /current\.some\(\(candidate\) =>/);
assert.match(s, /candidate\.title === revision\.title/);
assert.match(s, /candidate\.body === revision\.body/);
assert.match(s, /JSON\.stringify\(candidate\.tags\) === JSON\.stringify\(revision\.tags\)/);
console.log('revision duplicate suppression: ok');
