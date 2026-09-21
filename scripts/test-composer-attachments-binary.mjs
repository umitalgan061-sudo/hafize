import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments-policy.js','utf8');
assert.match(source,/function binaryScore/);
assert.match(source,/code === 0/);
assert.match(source,/code < 9/);
assert.match(source,/code > 13/);
console.log('composer attachment binary guard: ok');