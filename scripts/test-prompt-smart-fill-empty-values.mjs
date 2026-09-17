import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const text = fs.readFileSync(path.join(process.cwd(),'public/prompt-library-smart-fill.ts'),'utf8');
// Every declared variable must carry a non-blank value before transfer.
assert.match(text,/const missing = activeNames\.filter\(/);
assert.match(text,/\(values\[name\] \?\? ''\)\.trim\(\)\.length === 0/);
assert.match(text,/Doldurulmamış değişkenler/);
assert.match(text,/return showError/);
assert.match(text,/replaceVariables/);
assert.match(text,/composer\.value = text/);
console.log('prompt smart-fill empty-value guard: ok');
