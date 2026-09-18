import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
assert.match(source,/invalidCount/);
assert.match(source,/duplicateIdCount/);
assert.match(source,/orphanCollectionMembers/);
assert.doesNotMatch(source,/lastReport\.collections\.collections/);
console.log('prompt-library-diagnostics-report-privacy: ok');
