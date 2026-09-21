import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
for(const token of ['dataTransfer?.files','drag-over','preventDefault()','dragover','dragleave','drop']) assert.ok(source.includes(token));
console.log('composer attachment drag-drop: ok');