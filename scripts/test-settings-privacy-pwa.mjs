
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sw=readFileSync('public/sw-policy.ts','utf8');
const index=readFileSync('public/index.html','utf8');
for (const required of ['/settings-privacy.css','/typed-build/settings-privacy.js']) assert.ok(sw.includes(required),required);
assert.ok(index.includes('href="/settings-privacy.css"'));
assert.ok(index.includes('src="/settings-privacy.js"'));
console.log('privacy PWA contract ok');
