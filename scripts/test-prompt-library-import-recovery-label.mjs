import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-import-preview.js','utf8');
assert.match(source,/Kaynak türü/);
assert.match(source,/Recovery yedeği/);
assert.match(source,/Prompt Library yedeği|JSON yedeği/);
console.log('prompt-library-import-recovery-label: ok');
