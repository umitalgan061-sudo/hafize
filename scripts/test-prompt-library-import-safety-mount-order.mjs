import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { assertModuleDelivered } from './shell-cache-contract.mjs';
import { readFileSync } from 'node:fs';
const [index, safety, preview, diagnostics, sw] = await Promise.all([
  fs.readFile('public/index.html', 'utf8'),
  fs.readFile('public/typed/legacy/prompt-library-safety.ts', 'utf8'),
  fs.readFile('public/typed/legacy/prompt-library-import-preview.ts', 'utf8'),
  fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts', 'utf8'),
  fs.readFile('public/sw-policy.ts', 'utf8')
]);

// Bundled into the legacy entry, so the pre-migration filename is gone from the page.
assertModuleDelivered('prompt-library-safety');
assertModuleDelivered('prompt-library-import-preview');
assertModuleDelivered('prompt-library-diagnostics');

// All three share the legacy entry, so their mount order is the import order in it:
// safety publishes the recovery API, the import preview builds on it, and
// diagnostics renders on top of both.
const legacyEntry = readFileSync(new URL('../public/typed/legacy-app.ts', import.meta.url), 'utf8');
const safetyPos = legacyEntry.indexOf('./legacy/prompt-library-safety.ts');
const previewPos = legacyEntry.indexOf('./legacy/prompt-library-import-preview.ts');
const diagnosticsPos = legacyEntry.indexOf('./legacy/prompt-library-diagnostics.ts');
assert.ok(safetyPos >= 0 && previewPos >= 0 && diagnosticsPos >= 0);
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
assert.match(diagnostics, /dataset\.diagnosticsRepair/);
assert.match(diagnostics, /Onarım planını kopyala/);
assert.match(diagnostics, /Karantinayı geri al/);
assert.match(diagnostics, /Son onarımı geri al/);

// The carrying entry is what the service worker caches; assertModuleDelivered above
// already checks it for each of the three modules.

assert.doesNotMatch(safety + preview + diagnostics, /XMLHttpRequest|WebSocket|navigator\.sendBeacon/);

console.log('prompt-library-import-safety-mount-order: ok');
