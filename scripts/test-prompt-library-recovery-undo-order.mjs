import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8');
const restore=source.indexOf('writeJson(storage, PROMPT_KEY, payload.prompts)');
const clear=source.indexOf('writeJson(storage, REPAIR_BACKUP_KEY, null)');
assert.ok(restore>=0 && clear>restore);
console.log('prompt-library-recovery-undo-order: ok');
