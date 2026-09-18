import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [index, safety, preview, diagnostics, sw] = await Promise.all([
  fs.readFile('public/index.html', 'utf8'),
  fs.readFile('public/prompt-library-safety.js', 'utf8'),
  fs.readFile('public/prompt-library-import-preview.js', 'utf8'),
  fs.readFile('public/prompt-library-diagnostics.js', 'utf8'),
  fs.readFile('public/sw-policy.js', 'utf8')
]);

assert.ok(index.includes('/prompt-library-safety.js'));
assert.ok(index.includes('/prompt-library-import-preview.js'));
assert.ok(index.includes('/prompt-library-diagnostics.js'));

const safetyPos = index.indexOf('/prompt-library-safety.js');
const previewPos = index.indexOf('/prompt-library-import-preview.js');
const diagnosticsPos = index.indexOf('/prompt-library-diagnostics.js');
assert.ok(safetyPos < previewPos && previewPos < diagnosticsPos);

assert.match(safety, /normalizeRecoveryPayload/);
assert.match(safety, /buildRepairPreview/);
assert.match(safety, /quarantineInvalidItems/);
assert.match(safety, /undoLastRepair/);

assert.match(preview, /MAX_FILE/);
assert.match(preview, /stopImmediatePropagation/);
assert.match(preview, /applyImportPlan/);
assert.match(preview, /event.key === 'Escape'/);

assert.match(diagnostics, /MAX_ORPHANS/);
assert.match(diagnostics, /aria-expanded/);
assert.match(diagnostics, /data-diagnostics-repair/);
assert.match(diagnostics, /Onarım planını kopyala/);
assert.match(diagnostics, /Karantinayı geri al/);
assert.match(diagnostics, /Son onarımı geri al/);

for (const asset of ['prompt-library-safety.js', 'prompt-library-import-preview.js', 'prompt-library-diagnostics.js']) {
  assert.ok(sw.includes('/' + asset));
}

assert.doesNotMatch(safety + preview + diagnostics, /XMLHttpRequest|WebSocket|navigator\.sendBeacon/);

console.log('prompt-library-import-safety-mount-order: ok');
