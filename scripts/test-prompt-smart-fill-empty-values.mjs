import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const text = fs.readFileSync(path.join(process.cwd(),'public/prompt-library-smart-fill.ts'),'utf8');
// Empty fields are collected and named back to the reader rather than
// reported with one generic message.
assert.match(text,/const missing = activeNames\.filter\(\(name\) => values\[name\]\.trim\(\)\.length === 0\)/);
assert.match(text,/if \(missing\.length\) return showError\(`Doldurulmamış değişkenler: /);
assert.match(text,/replaceVariables/);
assert.match(text,/composer\.value = text/);
console.log('prompt smart-fill empty-value guard: ok');
