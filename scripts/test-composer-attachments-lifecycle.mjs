import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/clearTimeout/);
assert.match(source,/destroy:\\s*\\(\\)\\s*=>/);
assert.match(source,/delete rootRef\\.HafizeComposerAttachmentsController/);
assert.match(source,/MEMORY_TTL_MS/);
console.log('composer attachment lifecycle: ok');