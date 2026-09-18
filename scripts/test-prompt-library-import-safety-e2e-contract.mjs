import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const files = await Promise.all([
  fs.readFile('public/prompt-library-safety.js', 'utf8'),
  fs.readFile('public/prompt-library-import-preview.js', 'utf8'),
  fs.readFile('public/prompt-library-diagnostics.js', 'utf8'),
  fs.readFile('public/prompt-library.css', 'utf8'),
  fs.readFile('public/index.html', 'utf8'),
  fs.readFile('public/sw-policy.js', 'utf8')
]);
const [safety, preview, diagnostics, css, index, sw] = files;

assert.match(safety, /MAX_IMPORT_BYTES/);
assert.match(safety, /MAX_ITEMS/);
assert.match(safety, /normalizeRecoveryPayload/);
assert.match(safety, /buildImportPlan/);
assert.match(safety, /buildRepairPreview/);
assert.match(safety, /quarantineInvalidItems/);
assert.match(safety, /restoreQuarantine/);
assert.match(safety, /createRepairCheckpoint/);
assert.match(safety, /undoLastRepair/);
assert.match(safety, /exportRecoverySnapshot/);

assert.match(preview, /MAX_FILE/);
assert.match(preview, /normalizeImportedPayload/);
assert.match(preview, /mergeImportedItems/);
assert.match(preview, /stopImmediatePropagation/);
assert.match(preview, /role', 'dialog'/);
assert.match(preview, /aria-modal/);
assert.match(preview, /StorageEvent/);

assert.match(diagnostics, /MAX_ORPHANS/);
assert.match(diagnostics, /buildRepairPreview/);
assert.match(diagnostics, /data-diagnostics-repair/);
assert.match(diagnostics, /quarantineInvalidItems/);
assert.match(diagnostics, /restoreQuarantine/);
assert.match(diagnostics, /undoLastRepair/);
assert.match(diagnostics, /exportRecoverySnapshot/);
assert.match(diagnostics, /Onarım planını kopyala/);

assert.match(css, /prompt-library-import-dialog/);
assert.match(css, /prompt-library-diagnostics-repair-preview/);
assert.match(css, /forced-colors:active/);

for (const asset of [
  'prompt-library-safety.js',
  'prompt-library-import-preview.js',
  'prompt-library-diagnostics.js'
]) {
  assert.ok(index.includes('/' + asset));
  assert.ok(sw.includes('/' + asset));
}

const combined = safety + preview + diagnostics;
assert.doesNotMatch(combined, /XMLHttpRequest/);
assert.doesNotMatch(combined, /WebSocket/);
assert.doesNotMatch(combined, /navigator\.sendBeacon/);

console.log('prompt-library-import-safety-e2e-contract: ok');
