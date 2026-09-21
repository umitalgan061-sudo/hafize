import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/let items = \[\]/);
assert.match(source,/MEMORY_TTL_MS = 15 \* 60 \* 1000/);
assert.match(source,/items = \[\]/);
assert.match(source,/clearTimeout/);
console.log('composer attachment memory policy: ok');