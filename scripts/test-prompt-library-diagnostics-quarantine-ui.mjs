import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
assert.match(source,/Karantinadaki geçersiz kayıtlar/);
assert.match(source,/quarantineInvalidItems/);
assert.match(source,/Geçersiz kayıtları kaldır/, 'quarantine action is reachable');
assert.match(source,/Karantinayı geri al/);
console.log('prompt-library-diagnostics-quarantine-ui: ok');
