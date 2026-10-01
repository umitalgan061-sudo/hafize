import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertCacheVersionAtLeast } from './shell-cache-contract.mjs';

const source = fs.readFileSync('public/sw-policy.js','utf8');
assertCacheVersionAtLeast(49, 'prompt smart views');
for (const asset of [
  '/prompt-library-smart-views.css',
  '/prompt-library-smart-views-extras.css',
  '/prompt-library-smart-views.js',
  '/prompt-library-smart-views-history.js',
  '/prompt-library-smart-views-builder.js'
]) assert.ok(source.includes(asset), asset);
assert.match(source,/pathname\.startsWith\('\/api\/'\)/);
console.log('smart-view PWA contract: ok');