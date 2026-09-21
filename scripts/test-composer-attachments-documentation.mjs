import assert from 'node:assert/strict';
import fs from 'node:fs';
const readme=fs.readFileSync('README.md','utf8');
const doc=fs.readFileSync('docs/COMPOSER_ATTACHMENTS.md','utf8');
assert.ok(readme.includes('Composer Ekleri'));
assert.ok(doc.includes('11.500'));
assert.ok(doc.includes('256 KB'));
assert.ok(doc.includes('15 dakika'));
console.log('attachment documentation contract: ok');