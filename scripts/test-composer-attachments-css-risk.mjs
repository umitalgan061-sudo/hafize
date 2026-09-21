import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.css','utf8');
assert.match(s,/composer-attachment-risk/);
assert.match(s,/composer-attachments-quick-actions/);
assert.match(s,/focus-visible/);
console.log('attachment CSS risk and quick actions: ok');