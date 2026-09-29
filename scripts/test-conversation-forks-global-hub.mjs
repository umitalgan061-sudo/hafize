import assert from 'node:assert/strict';
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/renderGlobalBranchHub/);
assert.match(s,/hafizeConversationForkHub/);
assert.match(s,/Tüm dallar/);
assert.match(s,/Tüm konuşma dallarında ara/);
console.log('conversation fork global hub: ok');