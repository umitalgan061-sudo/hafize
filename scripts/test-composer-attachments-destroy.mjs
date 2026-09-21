import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(s,/destroy:\s*\(\)\s*=>/);
assert.match(s,/clearTimeout/);
assert.match(s,/removeEventListener/);
assert.match(s,/panel\.remove\(\)/);
assert.match(s,/fileInput\.remove\(\)/);
console.log('attachment destroy: ok');