import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/type = 'checkbox'/);
assert.match(source,/item\.selected/);
assert.match(source,/Tüm ekleri kaldır/);
assert.match(source,/Seçilenleri mesaja ekle/);
console.log('composer attachment user control: ok');