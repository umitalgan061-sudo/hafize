import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/accepted\.length \+ current\.length >= MAX_ITEMS/);
assert.match(source,/capacitySkipped\s*(?:\+\+|\+=\s*1)/, 'skipped-for-capacity items are counted');
assert.match(source,/acceptedCount/);
console.log('prompt-library-import-capacity: ok');
