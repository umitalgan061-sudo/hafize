import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/index.html','utf8');
assert.ok(s.indexOf('/composer-attachments-policy.js')<s.indexOf('/composer-attachments-secret-scan.js'));
assert.ok(s.indexOf('/composer-attachments-secret-scan.js')<s.indexOf('/composer-attachments.js'));
console.log('attachment PWA load order: ok');