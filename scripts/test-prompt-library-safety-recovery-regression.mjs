import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const [safety,preview,diag]=await Promise.all([
  fs.readFile('public/prompt-library-safety.js','utf8'),
  fs.readFile('public/prompt-library-import-preview.js','utf8'),
  fs.readFile('public/prompt-library-diagnostics.js','utf8')
]);
assert.match(safety,/normalizeRecoveryPayload/);
assert.match(safety,/buildRepairPreview/);
assert.match(safety,/undoLastRepair/);
assert.match(safety,/quarantineInvalidItems/);
assert.match(preview,/applyImportPlan/);
assert.match(preview,/StorageEvent/);
assert.match(diag,/buildRepairPreview/);
assert.match(diag,/undoLastRepair/);
assert.match(diag,/quarantineInvalidItems/);
console.log('prompt-library-safety-recovery-regression: ok');
