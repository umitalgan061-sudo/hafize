import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(source, /MAX_PER_PROMPT\s*=\s*8/);
assert.match(source, /MAX_REVISIONS\s*=\s*240/);
assert.match(source, /function capture\(/);
assert.match(source, /function restore\(/);
assert.match(source, /before-restore/);
assert.match(source, /source/);
assert.equal(source.includes('root.localStorage'), true);
assert.equal(source.includes('promptId'), true);
console.log('prompt workspace revisions: ok');
