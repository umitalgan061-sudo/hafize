import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const i=readFileSync('public/index.html','utf8');
const sw=readFileSync('public/sw-policy.js','utf8');
assert.ok(i.includes('/settings-privacy.css'));
assert.ok(i.includes('/settings-privacy.js'));
assert.ok(sw.includes('/settings-privacy.css'));
assert.ok(sw.includes('/settings-privacy.js'));
console.log('privacy PWA final asset contract ok');
