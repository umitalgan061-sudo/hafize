import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-import-preview.js','utf8');
const confirm=source.indexOf('data-import-confirm');
const apply=source.indexOf('applyImportPlan');
assert.ok(confirm>=0 && apply>=0 && confirm<apply);
console.log('prompt-library-import-confirm-write: ok');
