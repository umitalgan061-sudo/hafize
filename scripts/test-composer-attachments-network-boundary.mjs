import assert from 'node:assert/strict';
import fs from 'node:fs';
const files=['public/composer-attachments-policy.js','public/composer-attachments.js'];
for(const file of files){ const source=fs.readFileSync(file,'utf8'); assert.doesNotMatch(source,/fetch\\s*\\(/); assert.doesNotMatch(source,/XMLHttpRequest/); assert.doesNotMatch(source,/WebSocket/); assert.doesNotMatch(source,/sendBeacon/); }
console.log('composer attachment network boundary: ok');