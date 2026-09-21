import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
for(const action of ['summary','review','bugs','requirements']) assert.ok(s.includes(`'${action}'`));
assert.match(s,/quickPrompts/);
assert.match(s,/runQuickAction/);
assert.match(s,/Gönderim otomatik yapılmadı/);
console.log('attachment quick actions: ok');