import { assertLegacyModuleOrder } from './legacy-bundle-contract.mjs';

// Import safety has to be installed before the import preview can hand it a
// payload, and diagnostics reads what both of them wrote.
assertLegacyModuleOrder([
  'prompt-library-safety',
  'prompt-library-import-preview',
  'prompt-library-diagnostics'
]);
console.log('prompt-library-import-pwa-order: ok');
