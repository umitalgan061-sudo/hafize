import assert from 'node:assert/strict';
import fs from 'node:fs';
for(const file of ['public/composer-attachments.js','public/composer-attachments-policy.js','public/composer-attachments-secret-scan.js']){ const s=fs.readFileSync(file,'utf8'); assert.doesNotMatch(s,/localStorage|sessionStorage|indexedDB/); }
console.log('attachment no-storage: ok');