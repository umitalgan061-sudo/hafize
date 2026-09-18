import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/REPAIR_BACKUP_KEY/);
assert.match(source,/createRepairCheckpoint/);
assert.match(source,/hasRepairCheckpoint/);
assert.match(source,/undoLastRepair/);
assert.match(source,/createRepairCheckpoint\(storage\)/);
console.log('prompt-library-repair-checkpoint: ok');
