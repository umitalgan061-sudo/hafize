import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /hafize-prompt-library-collections/);
assert.match(source, /version: 1/);
assert.match(source, /collections/);
assert.match(source, /assignments: map/);
assert.match(source, /output\.length <= MAX_EXPORT/);
assert.match(source, /Object\.fromEntries/);
assert.match(source, /JSON\.parse\(String\(reader\.result/);
console.log('prompt library collections backup contract: ok');
