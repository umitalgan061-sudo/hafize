import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(s,/const before = input\.value\.slice\(0, start\)/);
assert.match(s,/const after = input\.value\.slice\(end\)/);
assert.match(s,/input\.value = before \+ payload \+ after/);
console.log('attachment input preservation: ok');