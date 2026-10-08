import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const source = fs.readFileSync('public/sw-policy.ts','utf8');
assertVersionedCacheDeclaration(source);
for (const asset of [
  '/prompt-library-smart-views.css',
  '/prompt-library-smart-views-extras.css',
  '/prompt-library-smart-views.js',
  '/prompt-library-smart-views-history.js',
  '/prompt-library-smart-views-builder.js'
]) assert.ok(source.includes(asset), asset);
assert.match(source,/pathname\.startsWith\('\/api\/'\)/);
console.log('smart-view PWA contract: ok');