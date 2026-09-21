import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
for(const token of ['Seçilenleri mesaja ekle','Son eklemeyi geri al','Dosya seç','Önizleme','dragover','drop','clipboardData','destroy','getMemoryTtlMs']) assert.ok(source.includes(token));
assert.ok(source.includes("role', 'status"));
assert.ok(source.includes('aria-live'));
assert.ok(source.includes("hafize:composer-attachments-inserted"));
console.log('composer attachment source: ok');