import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/local-data-center.js', 'utf8');
assert.match(source, /let destroyed = false/);
assert.match(source, /if \(destroyed\) return/);
assert.match(source, /listeners\.splice\(0\)/);
assert.match(source, /section\.remove\(\)/);
assert.match(source, /event\.key === null/);
assert.match(source, /KNOWN_KEYS\.has\(event\.key\)/);
assert.doesNotMatch(source, /setInterval/);
console.log('local data center lifecycle: ok');
