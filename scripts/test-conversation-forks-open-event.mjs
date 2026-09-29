import assert from 'node:assert/strict';
const s=require('node:fs').readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/hafize:open-conversation/);
assert.match(s,/activeConversationId = conversationId/);
assert.match(s,/conversationId.*string/);
console.log('conversation fork open event: ok');