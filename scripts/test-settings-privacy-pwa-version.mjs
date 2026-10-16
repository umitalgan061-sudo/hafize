import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const sw=readFileSync('public/sw-policy.ts','utf8');
assert.ok(sw.includes('v51'));
assert.ok(sw.includes('/settings-privacy.css'));
assert.ok(sw.includes('/settings-privacy.js'));
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
console.log('privacy PWA version contract ok');
