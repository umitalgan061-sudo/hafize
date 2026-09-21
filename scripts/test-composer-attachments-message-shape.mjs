import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments-policy.js','utf8');
assert.match(source,/\[Dosya:/);
assert.match(source,/fence/);
assert.match(source,/languageOf/);
assert.match(source,/formatRangeForComposer/);
console.log('composer attachment message shape: ok');