import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(s, /hafize\.prompt-library\.revisions\.v1/);
assert.doesNotMatch(s, /hafize\.prompt-library\.v1['"]\s*=|setItem\([^)]*prompt-library\.v1(?!\.revisions)/);
assert.match(s, /function readAll/);
assert.match(s, /function writeAll/);
console.log('revision main-storage isolation: ok');
