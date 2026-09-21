import assert from 'node:assert/strict';
import fs from 'node:fs';
const files=['public/composer-attachments.js','public/composer-attachments-policy.js','public/composer-attachments-secret-scan.js'];
for(const file of files){ const s=fs.readFileSync(file,'utf8'); for(const x of ['setItem','getItem','removeItem']) assert.doesNotMatch(s,new RegExp(x+'\\(')); }
console.log('attachment content storage boundary: ok');