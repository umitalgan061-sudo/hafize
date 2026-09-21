import assert from 'node:assert/strict';
import fs from 'node:fs';
const d=fs.readFileSync('docs/COMPOSER_ATTACHMENTS_SECURITY.md','utf8');
for(const x of ['byte','DOM','network','localStorage','No-submit','Auto-expiry']) assert.ok(d.toLocaleLowerCase('tr-TR').includes(x.toLocaleLowerCase('tr-TR')));
console.log('attachment security doc: ok');