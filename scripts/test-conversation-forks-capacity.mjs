import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s = readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/all\.length >= MAX_CONVERSATIONS/); assert.match(s,/branchCount\(source\.id, all\) >= MAX_BRANCHES_PER_PARENT/);
assert.match(s,/depth >= MAX_FORK_DEPTH/);
console.log('conversation fork capacity: ok');