import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-smart-views.js','utf8');
assert.match(source,/hafize\.prompt-library\.smart-views\.v1/);
assert.match(source,/function load\(/);
assert.match(source,/function save\(/);
assert.match(source,/storage\?\.getItem/);
assert.match(source,/storage\?\.setItem/);
console.log('smart-view storage contract: ok');