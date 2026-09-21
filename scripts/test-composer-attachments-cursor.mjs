import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/input\.selectionStart/);
assert.match(source,/input\.selectionEnd/);
assert.match(source,/const before = input\.value\.slice/);
assert.match(source,/const after = input\.value\.slice/);
console.log('composer attachment cursor insertion: ok');