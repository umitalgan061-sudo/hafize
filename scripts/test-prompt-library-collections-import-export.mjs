import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /function exportPayload/);
assert.match(source, /source: 'hafize-prompt-library-collections'/);
assert.match(source, /function normalizeImported/);
assert.match(source, /function mergeImported/);
assert.match(source, /toLocaleLowerCase\('tr-TR'\)/);
assert.match(source, /while \(ids\.has\(nextId\)\)/);
assert.match(source, /500 KB/);
assert.match(source, /FileReader/);
console.log('prompt library collections import/export: ok');
