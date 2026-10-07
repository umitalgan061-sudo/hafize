// Mount order for the import-safety stack.
//
// The three modules share the single legacy entry, so index.html no longer lists
// them separately: their order is the import order inside public/typed/legacy-app.ts.
// Safety publishes the recovery API, the import preview builds on it, and
// diagnostics renders on top of both.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertModuleDelivered } from './shell-cache-contract.mjs';

const entry = await fs.readFile('public/typed/legacy-app.ts', 'utf8');
const safety = entry.indexOf('./legacy/prompt-library-safety.ts');
const preview = entry.indexOf('./legacy/prompt-library-import-preview.ts');
const diagnostics = entry.indexOf('./legacy/prompt-library-diagnostics.ts');
assert.ok(safety >= 0 && preview > safety && diagnostics > preview);
for (const name of ['prompt-library-safety', 'prompt-library-import-preview', 'prompt-library-diagnostics']) {
  assertModuleDelivered(name);
}
console.log('prompt-library-import-pwa-order: ok');
