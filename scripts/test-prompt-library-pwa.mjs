import fs from 'node:fs';
import { assertModuleShipped, assertStylesheetShipped, assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

// Asset names moved with the TypeScript migration, so the helper resolves which
// bundle ships each module instead of pinning file names here.
assertStylesheetShipped('/prompt-library.css');
for (const module of ['prompt-library', 'prompt-library-starters', 'prompt-library-enhancements']) {
  assertModuleShipped(module);
}
assertVersionedCacheDeclaration(fs.readFileSync(new URL('../public/sw-policy.ts', import.meta.url), 'utf8'));
console.log('test-prompt-library-pwa: ok');
