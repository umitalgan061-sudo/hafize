import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/attach\.focus\(\)/);
assert.match(source,/Escape/);
assert.match(source,/role', 'button/);
assert.match(source,/tabIndex = 0/);
console.log('composer attachment focus: ok');