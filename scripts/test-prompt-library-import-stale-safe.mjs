import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8');
assert.match(source,/freshCurrent\(storage\)/);
assert.match(source,/applyImportPlan/);
assert.match(source,/mergeImportedItems\?\./);
console.log('prompt-library-import-stale-safe: ok');
