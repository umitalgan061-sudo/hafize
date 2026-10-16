import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8');
assert.match(source,/normalizeRecoveryPayload/);
assert.match(source,/Array\.isArray\(payload\.prompts\)/);
assert.match(source,/source: 'hafize-prompt-library-recovery'/);
console.log('prompt-library-recovery-import-wrapper: ok');
