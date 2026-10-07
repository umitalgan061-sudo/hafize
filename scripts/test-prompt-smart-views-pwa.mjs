import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/sw-policy.ts','utf8');
// The shell cache version is bumped on every shell change, so a literal version
// turns an unrelated change into a failure here. The invariant is what matters.
assert.match(source, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'shell cache name carries a numeric version');
for (const asset of [
  '/prompt-library-smart-views.css',
  '/prompt-library-smart-views-extras.css',
  '/prompt-library-smart-views.js',
  '/prompt-library-smart-views-history.js',
  '/prompt-library-smart-views-builder.js'
]) assert.ok(source.includes(asset), asset);
assert.match(source,/pathname\.startsWith\('\/api\/'\)/);
console.log('smart-view PWA contract: ok');