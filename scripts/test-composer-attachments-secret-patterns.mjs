import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments-secret-scan.js','utf8');
for(const pattern of ['BEGIN .*PRIVATE KEY','gh[pousr]_','sk-','AKIA','AIza','xox','eyJ']) assert.ok(s.includes(pattern));
assert.match(s,/MAX_MATCHES = 12/);
console.log('attachment secret patterns: ok');