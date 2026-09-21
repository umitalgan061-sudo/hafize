import assert from 'node:assert/strict';
import fs from 'node:fs';
const i=fs.readFileSync('public/index.html','utf8');
const w=fs.readFileSync('public/sw-policy.js','utf8');
for(const x of ['composer-attachments.css','composer-attachments-policy.js','composer-attachments-secret-scan.js','composer-attachments.js']) { assert.ok(i.includes(x)); assert.ok(w.includes('/'+x)); }
assert.match(w,/CURRENT_CACHE.*v37/);
console.log('attachment final PWA: ok');