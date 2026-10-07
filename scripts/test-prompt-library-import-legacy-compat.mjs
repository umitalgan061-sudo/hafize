import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8');
assert.match(source,/Array\.isArray\(payload\)/);
assert.match(source,/payloadItems/);
assert.match(source,/normalizeRecoveryPayload/);
console.log('prompt-library-import-legacy-compat: ok');
