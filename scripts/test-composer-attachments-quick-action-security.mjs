import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
const risk=s.indexOf('const risky = selected.filter');
const prompt=s.indexOf('const prompt = quickPrompts[kind]');
const confirm=s.indexOf('rootRef.confirm');
assert.ok(prompt>=0 && risk>=0 && confirm>risk);
assert.match(s,/quickPrompts/);
console.log('attachment quick action security: ok');