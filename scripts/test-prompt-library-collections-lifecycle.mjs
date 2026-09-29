import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /const listeners = \[\]/);
assert.match(source, /observer\?\.disconnect/);
assert.match(source, /listeners\.splice\(0\)/);
assert.match(source, /panel\.remove\(\)/);
assert.match(source, /observer\?\.observe/);
assert.match(source, /addEventListener\('storage'/);
console.log('prompt library collections lifecycle: ok');
