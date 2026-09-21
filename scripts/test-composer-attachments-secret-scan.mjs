import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments-secret-scan.js','utf8');
for(const token of ['private-key','github-token','aws-access-key','google-key','slack-token','jwt','connection-secret']) assert.ok(source.includes(token));
assert.match(source,/MAX_SCAN_CHARS = 80_000/);
assert.match(source,/MAX_MATCHES = 12/);
assert.match(source,/function scan/);
console.log('composer attachment secret scan: ok');