import assert from 'node:assert/strict';
import fs from 'node:fs';
const index=fs.readFileSync('public/index.html','utf8');
const sw=fs.readFileSync('public/sw-policy.js','utf8');
const runtime=fs.readFileSync('public/composer-attachments.js','utf8');
for(const x of ['composer-attachments.css','composer-attachments-policy.js','composer-attachments-secret-scan.js','composer-attachments.js']) assert.ok(index.includes(x));
assert.ok(sw.includes('CURRENT_CACHE'));
assert.ok(runtime.includes('Gönderim otomatik yapılmadı'));
console.log('attachment release gate: ok');