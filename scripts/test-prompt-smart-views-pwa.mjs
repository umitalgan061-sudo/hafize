import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertCacheVersionAtLeast } from './shell-cache-contract.mjs';

const source = fs.readFileSync('public/sw-policy.ts','utf8');
assertCacheVersionAtLeast(49, source);
for (const asset of [
  '/prompt-library-smart-views.css',
  '/prompt-library-smart-views-extras.css',
  '/typed-build/legacy-app.js',
  '/typed-build/legacy-app.js',
  '/typed-build/legacy-app.js'
]) assert.ok(source.includes(asset), asset);
assert.match(source,/pathname\.startsWith\('\/api\/'\)/);
console.log('smart-view PWA contract: ok');