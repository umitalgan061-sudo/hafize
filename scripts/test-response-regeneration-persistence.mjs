import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/saveConversations\(\)/);
assert.match(s,/message\.alternates/);
assert.match(s,/message\.generation/);
assert.match(s,/message\.feedback/);
console.log('response persistence contract ok');