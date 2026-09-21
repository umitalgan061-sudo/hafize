import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/rootRef\.confirm/);
assert.match(source,/Hassas içerik uyarısı/);
assert.match(source,/eklemek istiyor musun/);
assert.match(source,/return report\('Hassas içerik uyarısı nedeniyle ekleme iptal edildi\.'/);
console.log('composer attachment confirmation: ok');