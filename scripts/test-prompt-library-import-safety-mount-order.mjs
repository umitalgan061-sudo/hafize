import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertLegacyModuleOrder, assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';

const [index, safety, preview, diagnostics, sw] = await Promise.all([
  fs.readFile('public/index.html', 'utf8'),
  fs.readFile('public/typed/legacy/prompt-library-safety.ts', 'utf8'),
  fs.readFile('public/typed/legacy/prompt-library-import-preview.ts', 'utf8'),
  fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts', 'utf8'),
  fs.readFile('public/sw-policy.ts', 'utf8')
]);


assertLegacyModuleOrder(['prompt-library-safety', 'prompt-library-import-preview', 'prompt-library-diagnostics']);

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

assertLegacyModulesBundled(['prompt-library-safety', 'prompt-library-import-preview', 'prompt-library-diagnostics']);

assert.doesNotMatch(safety + preview + diagnostics, /XMLHttpRequest|WebSocket|navigator\.sendBeacon/);

assertLegacyModulesBundled(['prompt-library-diagnostics', 'prompt-library-import-preview', 'prompt-library-safety']);
console.log('prompt-library-import-safety-mount-order: ok');
