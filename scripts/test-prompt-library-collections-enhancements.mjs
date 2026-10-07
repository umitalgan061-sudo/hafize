import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/typed/legacy/prompt-library-collections-enhancements.ts', 'utf8');
assert.match(source, /Seçilenlerden koleksiyon/);
assert.match(source, /Tümünü seç/);
assert.match(source, /Seçimi kaldır/);
assert.match(source, /function createFromSelection/);
assert.match(source, /function duplicateCollection/);
assert.match(source, /MAX_SELECTION = 40/);
assert.match(source, /data-prompt-collection-action/);
assert.match(source, /data-collection-id/);
// Collection ids are minted by the core module, so this module must create through
// the shared API rather than inventing its own identifiers.
assert.match(source, /api\(\)\?\.createCollection\?\./);
assert.doesNotMatch(source, /Date\.now\(\)\s*\+|Math\.random/);
assert.match(
  fs.readFileSync('public/typed/legacy/prompt-library-collections.ts', 'utf8'),
  /crypto\?\.randomUUID/
);
assert.match(source, /CustomEvent\('hafize:prompt-library-collections-changed'/);
assert.match(source, /aria-label/);
assert.match(source, /textContent/);
assert.match(source, /DOMContentLoaded/);
assert.match(source, /beforeunload/);
assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /fetch\s*\(/);
console.log('prompt collection enhancements: ok');
