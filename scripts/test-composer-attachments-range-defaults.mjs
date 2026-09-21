import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/startLine: 1/);
assert.match(source,/endLine: Math\.min\(api\.lineCount/);
assert.match(source,/startLine \+ api\.MAX_RANGE_LINES - 1/);
console.log('composer attachment range defaults: ok');