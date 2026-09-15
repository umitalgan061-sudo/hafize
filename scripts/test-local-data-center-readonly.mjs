import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('public/local-data-center.js', 'utf8');
assert.match(source, /function inspect\(storage = safeStorage\(\)\)/);
assert.match(source, /function unknownKeys\(storage\)/);
assert.match(source, /APP_PREFIX = 'hafize\.'/);
assert.doesNotMatch(source, /clearAllKnown\(storage\).*removeItem/);
assert.match(source, /safeGet\(storage, store.key\)/);
console.log('local data center readonly inspection: ok');
