import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/CHECKPOINT_CORRUPT/);
assert.match(source,/CHECKPOINT_INVALID/);
assert.match(source,/PROMPT_RESTORE_FAILED/);
assert.match(source,/checkpoint\.payload/);
assert.match(source,/restored: payload\.prompts\.length/);
console.log('prompt-library-repair-undo: ok');
