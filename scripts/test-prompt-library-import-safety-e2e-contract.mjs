import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { assertModuleDelivered } from './shell-cache-contract.mjs';
const files = await Promise.all([
  fs.readFile('public/typed/legacy/prompt-library-safety.ts', 'utf8'),
  fs.readFile('public/typed/legacy/prompt-library-import-preview.ts', 'utf8'),
  fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts', 'utf8'),
  fs.readFile('public/prompt-library.css', 'utf8'),
  fs.readFile('public/index.html', 'utf8'),
  fs.readFile('public/sw-policy.ts', 'utf8')
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
assert.match(diagnostics, /dataset\.diagnosticsRepair/);
assert.match(diagnostics, /quarantineInvalidItems/);
assert.match(diagnostics, /restoreQuarantine/);
assert.match(diagnostics, /undoLastRepair/);
assert.match(diagnostics, /exportRecoverySnapshot/);
assert.match(diagnostics, /Onarım planını kopyala/);

assert.match(css, /prompt-library-import-dialog/);
assert.match(css, /prompt-library-diagnostics-repair-preview/);
assert.match(css, /forced-colors:active/);

// Bundled into the legacy entry, so the carrying entry is what the page loads and
// the service worker caches.
for (const name of ['prompt-library-safety', 'prompt-library-import-preview', 'prompt-library-diagnostics']) {
  assertModuleDelivered(name);
}

const combined = safety + preview + diagnostics;
assert.doesNotMatch(combined, /XMLHttpRequest/);
assert.doesNotMatch(combined, /WebSocket/);
assert.doesNotMatch(combined, /navigator\.sendBeacon/);

console.log('prompt-library-import-safety-e2e-contract: ok');
