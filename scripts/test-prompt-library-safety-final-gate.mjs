import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const [safety,preview,diag,index,sw]=await Promise.all([
  fs.readFile('public/prompt-library-safety.js','utf8'),
  fs.readFile('public/prompt-library-import-preview.js','utf8'),
  fs.readFile('public/prompt-library-diagnostics.js','utf8'),
  fs.readFile('public/index.html','utf8'),
  fs.readFile('public/sw-policy.js','utf8')
]);
for(const token of ['buildImportPlan','applyImportPlan','buildRepairPreview','quarantineInvalidItems','undoLastRepair','exportRecoverySnapshot']) assert.match(safety,new RegExp(token));
for(const token of ['MAX_FILE','stopImmediatePropagation','StorageEvent','role', 'aria-modal']) assert.ok(preview.includes(token));
for(const token of ['MAX_ORPHANS','data-diagnostics-repair','Yedek indir','Karantinayı geri al','Son onarımı geri al']) assert.ok(diag.includes(token));
for(const asset of ['prompt-library-safety.js','prompt-library-import-preview.js','prompt-library-diagnostics.js']) {
  assert.ok(index.includes('/'+asset));
  assert.ok(sw.includes('/'+asset));
}
assert.doesNotMatch(safety,/fetch\s*\(/);
assert.doesNotMatch(preview,/XMLHttpRequest|WebSocket/);
assert.doesNotMatch(diag,/navigator\.sendBeacon/);
console.log('prompt-library-safety-final-gate: ok');
