import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
for(const token of ['MAX_IMPORT_BYTES','MAX_ITEMS','QUARANTINE_KEY','REPAIR_BACKUP_KEY','buildImportPlan','buildRepairPreview','quarantineInvalidItems','undoLastRepair']) assert.match(source,new RegExp(token));
assert.match(source,/slice\(-80\)/);
assert.match(source,/slice\(0, MAX_ITEMS \* 2\)/);
console.log('prompt-library-final-data-safety: ok');
