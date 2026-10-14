import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/typed/legacy/prompt-library-smart-views.ts','utf8');
assert.match(source,/function parseQuery\(query\)/);
assert.match(source,/tag:/);
assert.match(source,/-tag:/);
assert.match(source,/is:favorite/);
assert.match(source,/has:variable/);
assert.match(source,/used:/);
assert.match(source,/function compareUsage/);
assert.match(source,/function matches/);
console.log('smart-view query contract: ok');