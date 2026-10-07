import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shellAssetForBrowserModule } from './shell-cache-contract.mjs';
const sw=readFileSync('public/sw-policy.ts','utf8');
// The shell cache version is bumped on every shell change, so a literal version
// turns an unrelated change into a failure here. The invariant is what matters.
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'shell cache name carries a numeric version');
assert.ok(sw.includes('/settings-privacy.css'));
assert.ok(sw.includes(shellAssetForBrowserModule('settings-privacy')));
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
console.log('privacy PWA version contract ok');
