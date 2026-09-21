import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.doesNotMatch(source,/requestSubmit|\\.submit\\s*\\(/);
assert.match(source,/input\\.dispatchEvent\\(new Event\\('input'/);
assert.ok(source.includes('Gönderim otomatik yapılmadı'));
console.log('composer attachment no-submit: ok');