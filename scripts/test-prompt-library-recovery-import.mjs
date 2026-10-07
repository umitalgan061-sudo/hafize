import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-import-preview.ts','utf8');
assert.match(source,/normalizeRecoveryPayload/);
assert.match(source,/recoveryPayload/);
assert.match(source,/isRecovery/);
assert.match(source,/Recovery yedeği/);
console.log('prompt-library-recovery-import: ok');
