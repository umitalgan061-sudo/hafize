import assert from 'node:assert/strict';
import fs from 'node:fs';
const d=fs.readFileSync('docs/COMPOSER_ATTACHMENTS_ROLLBACK.md','utf8');
for(const x of ['composer-attachments.js','composer-attachments-policy.js','composer-attachments.css','index.html','sw-policy.js','app.js']) assert.ok(d.includes(x));
console.log('attachment rollback doc: ok');