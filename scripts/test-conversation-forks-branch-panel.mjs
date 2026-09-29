import assert from 'node:assert/strict';
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/conversation-fork-panel/); assert.match(s,/childrenOf/); assert.match(s,/Dalını aç/);
console.log('conversation fork branch panel: ok');