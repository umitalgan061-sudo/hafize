import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(s,/const files = \[\.\.\.\(event\.clipboardData\?\.files \|\| \[\]\)\]/);
assert.match(s,/if \(!files\.length\) return/);
assert.match(s,/event\.preventDefault\(\)/);
console.log('attachment paste regression: ok');