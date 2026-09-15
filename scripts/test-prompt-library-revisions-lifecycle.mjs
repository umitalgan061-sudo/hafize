import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(s, /card\.dataset\.revisionsMounted/);
assert.match(s, /observer\?\.disconnect/);
assert.match(s, /panel\.remove\(\)/);
assert.match(s, /delete card\.dataset\.revisionsMounted/);
assert.match(s, /return Object\.freeze/);
console.log('revision lifecycle: ok');
