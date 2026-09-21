import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
const validate=s.indexOf('const validation = api.validateFile');
const read=s.indexOf('return api.readText(file)');
const normalize=s.indexOf('api.normalizeContent(raw)');
assert.ok(validate>=0); assert.ok(read>validate); assert.ok(normalize>read);
console.log('attachment read order: ok');