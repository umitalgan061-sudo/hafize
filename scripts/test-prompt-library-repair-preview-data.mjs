import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/function buildRepairPreview/);
for(const token of ['rawCount','normalizedCount','invalidCount','duplicateCount','collectionCount','revisionCount','rewrites']) assert.match(source,new RegExp(token));
console.log('prompt-library-repair-preview-data: ok');
