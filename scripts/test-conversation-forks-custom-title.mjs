import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/typed/conversation-fork-core.ts','utf8');
assert.match(s,/title = ''/);
assert.match(s,/requestedTitle/);
assert.match(s,/branchTitle/);
console.log('conversation fork custom title: ok');