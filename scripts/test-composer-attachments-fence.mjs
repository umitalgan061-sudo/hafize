import assert from 'node:assert/strict';
import fs from 'node:fs';
const p=fs.readFileSync('public/composer-attachments-policy.js','utf8');
assert.match(p,/includes\('```'\)/);
assert.match(p,/: '````'/);
assert.match(p,/languageOf\(item\.name\)/);
assert.match(p,/\[Dosya:/);
console.log('attachment fence contract: ok');