import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-smart-views-builder.js','utf8');
assert.match(source,/function buildQuery/);
assert.match(source,/used:>=/);
assert.match(source,/has:variable/);
assert.match(source,/is:favorite/);
assert.match(source,/Görünüm olarak kaydet/);
assert.match(source,/prompt-smart-view-builder/);
assert.match(source,/event\.key\.toLowerCase\(\) !== 'q'/);
assert.match(source,/typeof rootRef\.StorageEvent === 'function'/);
console.log('smart-view builder contract: ok');