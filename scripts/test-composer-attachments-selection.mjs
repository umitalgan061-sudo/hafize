import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(s,/type = 'checkbox'/);
assert.match(s,/checked = item\.selected/);
assert.match(s,/items\.filter\(\(item\) => item\.selected\)/);
assert.match(s,/Seçilenleri mesaja ekle/);
console.log('attachment selection: ok');