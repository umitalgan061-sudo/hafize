import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/maxLength = 80/);
assert.match(s,/toLocaleLowerCase\('tr-TR'\)/);
assert.match(s,/slice\(0, 12\)/);
console.log('conversation fork hub search: ok');