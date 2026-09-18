import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const [safety,diag,preview]=await Promise.all([
  fs.readFile('public/prompt-library-safety.js','utf8'),
  fs.readFile('public/prompt-library-diagnostics.js','utf8'),
  fs.readFile('public/prompt-library-import-preview.js','utf8')
]);
assert.match(safety,/createRepairCheckpoint/);
assert.match(safety,/hasRepairCheckpoint/);
assert.match(safety,/undoLastRepair/);
assert.match(safety,/restoreQuarantine/);
assert.match(diag,/removeEventListener/);
assert.match(diag,/section\.remove\(\)/);
assert.match(preview,/removeEventListener\('change', intercept, true\)/);
assert.match(preview,/dialog && dialog\.remove\(\)/);
console.log('prompt-library-recovery-lifecycle: ok');
