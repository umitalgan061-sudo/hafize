import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source = await fs.readFile('public/prompt-library-import-preview.js', 'utf8');
assert.match(source, /MAX_BYTES\s*=\s*1000000/);
assert.match(source, /file\.size > MAX_BYTES/);
assert.match(source, /JSON\.parse/);
assert.match(source, /applyImportPlan/);
assert.match(source, /stopImmediatePropagation/);
console.log('prompt-library-import-boundary: ok');
