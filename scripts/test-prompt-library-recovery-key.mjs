import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8');
assert.match(source,/hafize\.prompt-library\.repair-backup\.v1/);
assert.match(source,/hafize-prompt-library-recovery/);
console.log('prompt-library-recovery-key: ok');
