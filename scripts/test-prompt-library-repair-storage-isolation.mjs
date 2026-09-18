import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
for(const token of ['PROMPT_KEY','COLLECTION_KEY','REVISION_KEY','REPAIR_BACKUP_KEY']) assert.match(source,new RegExp(token));
console.log('prompt-library-repair-storage-isolation: ok');
