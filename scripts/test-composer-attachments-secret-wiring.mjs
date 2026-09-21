import assert from 'node:assert/strict';
import fs from 'node:fs';
const index=fs.readFileSync('public/index.html','utf8');
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.ok(index.includes('/composer-attachments-secret-scan.js'));
assert.match(source,/HafizeComposerSecretScanner/);
assert.match(source,/\.scan\?\./);
assert.match(source,/risk\?\.risky/);
console.log('composer attachment secret wiring: ok');