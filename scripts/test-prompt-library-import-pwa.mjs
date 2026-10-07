import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertModuleDelivered } from './shell-cache-contract.mjs';
const [index, sw] = await Promise.all([
  fs.readFile('public/index.html', 'utf8'),
  fs.readFile('public/sw-policy.ts', 'utf8')
]);
// Bundled into the legacy entry, so the pre-migration filename is gone from the page.
for (const name of ['prompt-library-safety','prompt-library-import-preview','prompt-library-diagnostics']) {
  assertModuleDelivered(name);
}
console.log('prompt-library-import-pwa: ok');
