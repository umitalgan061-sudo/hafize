import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/sw-policy.js','utf8');
assert.match(source,/CURRENT_CACHE = .*v49/);
for (const asset of [
  '/prompt-library-smart-views.css',
  '/prompt-library-smart-views-extras.css',
  '/prompt-library-smart-views.js',
  '/prompt-library-smart-views-history.js',
  '/prompt-library-smart-views-builder.js'
]) assert.ok(source.includes(asset), asset);
assert.match(source,/pathname\.startsWith\('\/api\/'\)/);
console.log('smart-view PWA contract: ok');