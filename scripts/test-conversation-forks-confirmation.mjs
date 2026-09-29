import assert from 'node:assert/strict';
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/openDialog/); assert.match(s,/Yeni dal oluştur/); assert.match(s,/writeConversations/);
assert.match(s,/onConfirm/);
console.log('conversation fork confirmation: ok');