import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(source, /\[revision, \.\.\.current\]\.slice\(0, MAX_REVISIONS\)/);
assert.match(source, /Object\.keys\(value\)\.slice\(0, MAX_PROMPTS\)/);
assert.match(source, /if \(revisions\.length\) output\[promptId\] = revisions/);
assert.match(source, /const revisions = Array\.isArray\(value\[promptId\]\)/);
console.log('prompt revision retention: ok');
