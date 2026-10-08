import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertShellCacheAtLeast } from './shell-cache-contract.mjs';
const sw=readFileSync('public/sw-policy.ts','utf8');
assertShellCacheAtLeast(51, 'settings privacy');
assert.ok(sw.includes('/settings-privacy.css'));
assert.ok(sw.includes('/settings-privacy.js'));
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
console.log('privacy PWA version contract ok');
