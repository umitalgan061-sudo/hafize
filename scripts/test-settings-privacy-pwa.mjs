
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sw=readFileSync('public/sw-policy.ts','utf8');
const index=readFileSync('public/index.html','utf8');
// The shell cache version is bumped on every shell change, so the invariant is
// asserted instead of a literal version; the entry moved behind typed-build.
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'shell cache name carries a numeric version');
for (const required of ['/settings-privacy.css','/typed-build/settings-privacy.js']) assert.ok(sw.includes(required),required);
assert.ok(index.includes('href="/settings-privacy.css"'));
assert.ok(index.includes('src="/typed-build/settings-privacy.js"'));
console.log('privacy PWA contract ok');
