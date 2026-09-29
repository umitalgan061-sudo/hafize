import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /function normalizeCollection/);
assert.match(source, /function loadCollections/);
assert.match(source, /function loadMap/);
assert.match(source, /function loadDefaultCollection/);
assert.match(source, /function pruneMap/);
assert.match(source, /function summarize/);
assert.match(source, /function normalizeImported/);
assert.match(source, /Object\.freeze/);
assert.match(source, /validCollections/);
assert.match(source, /validPrompts/);
console.log('prompt library collections data shapes: ok');
