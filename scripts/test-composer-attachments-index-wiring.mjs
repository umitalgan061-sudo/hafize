import assert from 'node:assert/strict';
import fs from 'node:fs';
const index=fs.readFileSync('public/index.html','utf8');
assert.ok(index.includes('/composer-attachments.css'));
assert.ok(index.includes('/composer-attachments-policy.js'));
assert.ok(index.includes('/composer-attachments.js'));
assert.ok(index.indexOf('/composer-attachments-policy.js')<index.indexOf('/composer-attachments.js'));
assert.ok(index.indexOf('/app.js')<index.indexOf('/composer-attachments-policy.js'));
console.log('composer attachment index wiring: ok');