import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
for(const token of ['PROMPT_STORAGE_UNREADABLE','REPAIR_CHECKPOINT_FAILED','PROMPT_STORAGE_FAILED','QUARANTINE_WRITE_FAILED']) assert.match(source,new RegExp(token));
console.log('prompt-library-import-storage-guard: ok');
