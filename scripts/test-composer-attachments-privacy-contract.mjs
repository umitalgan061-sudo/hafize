import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/composer-attachments.js','utf8');
for(const forbidden of ['localStorage','sessionStorage','indexedDB','caches.open','document.cookie']) assert.doesNotMatch(s,new RegExp(forbidden.replace('.','\\.')));
assert.match(s,/let items = \[\]/);
assert.match(s,/MEMORY_TTL_MS/);
console.log('attachment privacy contract: ok');