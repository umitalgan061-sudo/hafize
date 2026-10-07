import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/conversation-fork-panel/); assert.match(s,/childrenOf/); assert.match(s,/Dalını aç/);
console.log('conversation fork branch panel: ok');