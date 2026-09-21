import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/sw-policy.js','utf8');
assert.match(source,/CURRENT_CACHE = .*v37/);
for(const asset of ['composer-attachments.css','composer-attachments-policy.js','composer-attachments.js']) assert.ok(source.includes('/'+asset));
assert.match(source,/pathname\.startsWith\('\/api\/'\)/);
console.log('composer attachment service worker cache: ok');