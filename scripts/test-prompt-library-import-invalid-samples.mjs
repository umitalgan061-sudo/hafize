import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
assert.match(source,/invalidSamples/);
assert.match(source,/slice\(0, 6\)/);
assert.match(source,/nesne değil/);
assert.match(source,/body boş/);
console.log('prompt-library-import-invalid-samples: ok');
