import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
const c=fs.readFileSync('public/composer-attachments.css','utf8');
for(const x of ['Özetle','Kod incele','Hata ara','Gereksinime dönüştür','Kopyala','Son eklemeyi geri al','Önizleme']) assert.ok(s.includes(x));
assert.match(s,/aria-live/);
assert.match(s,/Escape/);
assert.match(c,/max-width:700px/);
console.log('attachment final UX: ok');