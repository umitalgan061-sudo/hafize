import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(source, /function mount\(/);
assert.match(source, /MutationObserver/);
assert.match(source, /observer\?\.observe/);
assert.match(source, /observer\?\.disconnect/);
assert.match(source, /addEventListener\?\.'?storage/);
assert.match(source, /removeEventListener\?\.'?storage/);
assert.match(source, /destroy:/);
assert.match(source, /section\.remove\(\)/);
assert.match(source, /clearTimeout/);
assert.match(source, /replaceChildren/);
assert.doesNotMatch(source, /setInterval/);
assert.doesNotMatch(source, /setInterval\(/);
assert.match(source, /DOMContentLoaded/);
console.log('prompt revision lifecycle contract: ok');
