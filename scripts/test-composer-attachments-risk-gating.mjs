import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
const risk=s.indexOf("const risky = selected.filter");
const confirm=s.indexOf('rootRef.confirm');
const write=s.indexOf('input.value = before + payload + after');
assert.ok(risk>=0 && confirm>risk && write>confirm);
console.log('attachment risk gate order: ok');