import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const [safety,diag,preview]=await Promise.all([
  fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8'),
  fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts','utf8'),
  fs.readFile('public/typed/legacy/prompt-library-import-preview.ts','utf8')
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
