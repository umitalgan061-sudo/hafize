import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(s,/selected\.map\(\(item\) => api\.formatRangeForComposer/);
assert.match(s,/item\.startLine, item\.endLine/);
assert.match(s,/quickPrompts/);
console.log('attachment quick range: ok');