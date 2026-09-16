import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-enhancements.js', 'utf8');
assert.match(source, /Seçilenlerden koleksiyon/);
assert.match(source, /Tümünü seç/);
assert.match(source, /Seçimi kaldır/);
assert.match(source, /function createFromSelection/);
assert.match(source, /function duplicateCollection/);
assert.match(source, /MAX_SELECTION = 40/);
assert.match(source, /data-prompt-collection-action/);
assert.match(source, /data-collection-id/);
// Ids come from the collections core rather than a second generator here.
assert.match(source, /api\(\)\?\.createCollection\?\./);
assert.match(source, /CustomEvent\('hafize:prompt-library-collections-changed'/);
assert.match(source, /aria-label/);
assert.match(source, /textContent/);
assert.match(source, /DOMContentLoaded/);
assert.match(source, /beforeunload/);
assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /fetch\s*\(/);
console.log('prompt collection enhancements: ok');
