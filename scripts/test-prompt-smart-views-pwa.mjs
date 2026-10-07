import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertCacheVersionAtLeast, assertShippedBrowserModule, assertShippedStylesheet } from './shell-cache-contract.mjs';

const source = fs.readFileSync('public/sw-policy.ts','utf8');
assertCacheVersionAtLeast(49);
assertShippedStylesheet('prompt-library-smart-views.css');
assertShippedStylesheet('prompt-library-smart-views-extras.css');
assertShippedBrowserModule('prompt-library-smart-views');
assertShippedBrowserModule('prompt-library-smart-views-history');
assertShippedBrowserModule('prompt-library-smart-views-builder');
assert.match(source,/pathname\.startsWith\('\/api\/'\)/);
console.log('smart-view PWA contract: ok');