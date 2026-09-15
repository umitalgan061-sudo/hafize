import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
assert.match(source, /DEFAULT_ID\s*=\s*['"]general['"]/);
assert.match(source, /function create\(/);
assert.match(source, /function rename\(/);
assert.match(source, /function remove\(/);
assert.match(source, /function assign\(/);
assert.match(source, /function assignMany\(/);
assert.equal(source.includes('data.assignments'), true);
assert.equal(source.includes('toLocaleLowerCase'), true);
assert.equal(source.includes('İstemler Genel koleksiyonuna'), false);
console.log('prompt workspace collections: ok');
