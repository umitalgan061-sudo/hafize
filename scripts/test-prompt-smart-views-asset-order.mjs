import { assertLegacyModuleOrder } from './legacy-bundle-contract.mjs';

// Smart views mount core-first: the view store, then history, then the query
// builder, then the safety layer that repairs broken records.
assertLegacyModuleOrder([
  'prompt-library-smart-views',
  'prompt-library-smart-views-history',
  'prompt-library-smart-views-builder',
  'prompt-library-smart-views-safety'
]);
console.log('smart-view asset order: ok');
