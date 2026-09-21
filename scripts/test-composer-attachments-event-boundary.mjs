import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(s,/hafize:composer-attachments-inserted/);
assert.match(s,/detail: \{ count/);
assert.doesNotMatch(s,/hafize\.prompt-library\.v1/);
assert.doesNotMatch(s,/hafize\.composer-history\.v1/);
console.log('attachment event boundary: ok');