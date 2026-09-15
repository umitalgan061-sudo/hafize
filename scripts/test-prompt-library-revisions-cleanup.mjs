import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(s, /function clear\(promptId\)/);
assert.match(s, /delete store\[id\]/);
assert.match(s, /function remove\(promptId, revisionId\)/);
assert.match(s, /filter\(\(revision\) => revision\.id !== rid\)/);
assert.match(s, /if \(next\.length\) store\[id\] = next/);
console.log('revision cleanup isolation: ok');
