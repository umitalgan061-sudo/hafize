import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertModuleShipped, assertStylesheetShipped, assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const sw = readFileSync('public/sw-policy.ts', 'utf8');
// Pinning one cache version made this gate rot on every shell change, so assert
// that a version is declared at all and that the surface is cached.
assertVersionedCacheDeclaration(sw);
assertStylesheetShipped('/settings-privacy.css');
assertModuleShipped('settings-privacy');
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
console.log('privacy PWA version contract ok');
