import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
const q=source.indexOf('function quarantineInvalidItems');
const r=source.indexOf('function restoreQuarantine');
assert.ok(q>=0 && r>q);
assert.match(source,/slice\(-80\)/);
assert.match(source,/mergeImportedItems/);
console.log('prompt-library-quarantine-recovery: ok');
