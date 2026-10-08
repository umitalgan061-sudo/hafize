import { readFileSync } from 'node:fs';
import { assertModuleShipped, assertStylesheetShipped, assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

assertVersionedCacheDeclaration(readFileSync('public/sw-policy.ts', 'utf8'));
assertStylesheetShipped('/settings-privacy.css');
assertModuleShipped('settings-privacy');
console.log('privacy PWA contract ok');
