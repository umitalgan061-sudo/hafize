import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(s,/scanner\?\.summary/);
assert.match(s,/item\.risk\?\.risky/);
assert.match(s,/hassas desen/);
assert.match(s,/findings/);
console.log('attachment risk summary: ok');