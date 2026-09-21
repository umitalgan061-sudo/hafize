import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
const v=s.indexOf('api.validateFile(file, items)');
const r=s.indexOf('api.readText(file)');
assert.ok(v>=0 && r>v);
console.log('attachment read limit ordering: ok');