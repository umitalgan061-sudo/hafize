import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
const p=fs.readFileSync('public/composer-attachments-policy.js','utf8');
assert.doesNotMatch(s,/setItem\(/);
assert.doesNotMatch(s,/getItem\(/);
assert.doesNotMatch(p,/localStorage/);
assert.doesNotMatch(p,/sessionStorage/);
console.log('attachment persistence boundary: ok');