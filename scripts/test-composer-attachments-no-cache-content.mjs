import assert from 'node:assert/strict';
import fs from 'node:fs';
const sw=fs.readFileSync('public/sw-policy.js','utf8');
const runtime=fs.readFileSync('public/composer-attachments.js','utf8');
assert.ok(sw.includes('composer-attachments.js'));
assert.doesNotMatch(runtime,/cacheStorage|Cache API|caches\.open/);
console.log('attachment cache content boundary: ok');