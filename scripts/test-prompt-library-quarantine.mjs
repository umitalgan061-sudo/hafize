import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/QUARANTINE_KEY/);
assert.match(source,/quarantineInvalidItems/);
assert.match(source,/restoreQuarantine/);
assert.match(source,/items: existing\.items\.concat/);
assert.match(source,/slice\(-80\)/);
console.log('prompt-library-quarantine: ok');
