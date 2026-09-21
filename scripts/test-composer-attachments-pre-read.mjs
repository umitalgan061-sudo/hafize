import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
const validation=source.indexOf('const validation = api.validateFile(file, items);');
const read=source.indexOf('return api.readText(file)');
assert.ok(validation>=0 && read>validation);
console.log('composer attachment pre-read validation: ok');