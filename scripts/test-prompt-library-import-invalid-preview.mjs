import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-import-preview.ts','utf8');
assert.match(source,/Atlanan kayıt örnekleri/);
assert.match(source,/invalidSamples/);
assert.match(source,/item\.reason/);
console.log('prompt-library-import-invalid-preview: ok');
