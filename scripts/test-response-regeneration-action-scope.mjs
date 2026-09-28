import fs from 'node:fs'; import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/message\.id !== messages\.at\(-1\)\?\.id/); assert.match(s,/canRegenerateResponse/);
console.log('response action scope contract ok');