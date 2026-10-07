import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts','utf8');
assert.match(source,/rawCount/);
assert.match(source,/normalizedCount/);
assert.match(source,/duplicateCount/);
assert.doesNotMatch(source,/preview\.normalizedItems/);
assert.doesNotMatch(source,/snapshot\.body/);
console.log('prompt-library-plan-privacy: ok');
