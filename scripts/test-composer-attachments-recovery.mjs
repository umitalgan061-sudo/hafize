import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(s,/let items = \[\]/);
assert.doesNotMatch(s,/localStorage/);
assert.match(s,/15 \* 60 \* 1000/);
console.log('attachment recovery: ok');