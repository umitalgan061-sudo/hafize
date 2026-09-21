import assert from 'node:assert/strict';
import fs from 'node:fs';
const index=fs.readFileSync('public/index.html','utf8');
const sw=fs.readFileSync('public/sw-policy.js','utf8');
for(const asset of ['composer-attachments-policy.js','composer-attachments.js','composer-attachments.css']) { assert.ok(index.includes(asset)); assert.ok(sw.includes(asset)); }
assert.match(sw,/CURRENT_CACHE.*v37/);
console.log('composer attachment PWA: ok');