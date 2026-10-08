import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';
const [index, sw] = await Promise.all([
  fs.readFile('public/index.html', 'utf8'),
  fs.readFile('public/sw-policy.ts', 'utf8')
]);
assertLegacyModulesBundled(['prompt-library-safety', 'prompt-library-import-preview', 'prompt-library-diagnostics']);
console.log('prompt-library-import-pwa: ok');
