import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
assert.match(source,/Son onarımı geri al/);
assert.match(source,/undo\.disabled/);
assert.match(source,/undoLastRepair/);
assert.match(source,/Son güvenli onarım geri alınsın mı/);
console.log('prompt-library-diagnostics-undo-ui: ok');
