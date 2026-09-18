import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/output\.length > 1000000/);
assert.match(source,/items\.concat\(removed\)\.slice\(-80\)/);
assert.match(source,/MAX_ITEMS\s*=\s*120/);
console.log('prompt-library-quarantine-bounds: ok');
