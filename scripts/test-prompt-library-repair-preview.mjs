import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts','utf8');
assert.match(source,/buildRepairPreview/);
assert.match(source,/Onarım önizlemesi/);
assert.match(source,/duplicateCount/);
assert.match(source,/orphanCollectionMembers/);
assert.match(source,/orphanRevisionRefs/);
console.log('prompt-library-repair-preview: ok');
