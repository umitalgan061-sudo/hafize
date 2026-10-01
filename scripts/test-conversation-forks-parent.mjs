import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/source\.id/); assert.match(s,/forkOf/); assert.match(s,/slice\(0, index \+ 1\)/);
console.log('conversation fork parent preservation: ok');