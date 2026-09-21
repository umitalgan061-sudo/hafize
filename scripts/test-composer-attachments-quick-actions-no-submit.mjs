import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
const q=s.indexOf('function runQuickAction');
assert.ok(q>=0);
assert.doesNotMatch(s.slice(q),/requestSubmit|\.submit\s*\(/);
assert.match(s.slice(q),/dispatchEvent\(new Event\('input'/);
console.log('attachment quick no-submit: ok');