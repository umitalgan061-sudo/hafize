import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/typed/conversation-fork-core.ts','utf8');
assert.match(s,/maxForkNote: 400/);
assert.match(s,/forkNote/);
assert.match(s,/note = ''/);
console.log('conversation fork note contract: ok');