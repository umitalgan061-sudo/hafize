import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
const check=source.indexOf("if (payload.length > available || payload.length > api.MAX_INSERT_CHARS)");
const write=source.indexOf('input.value = before + payload + after;');
assert.ok(check>=0 && write>check);
console.log('composer attachment atomic insert: ok');