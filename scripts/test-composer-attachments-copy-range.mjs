import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/Seçili aralığını panoya kopyala/);
assert.match(source,/navigator\?\.clipboard/);
assert.match(source,/sliceLines\(item\.content, item\.startLine, item\.endLine\)/);
console.log('composer attachment copy range: ok');