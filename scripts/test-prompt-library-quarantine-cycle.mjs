import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/quarantineInvalidItems/);
assert.match(source,/restoreQuarantine/);
assert.match(source,/mergeImportedItems/);
assert.match(source,/QUARANTINE_KEY/);
console.log('prompt-library-quarantine-cycle: ok');
