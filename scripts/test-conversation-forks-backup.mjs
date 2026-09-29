import assert from 'node:assert/strict';
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/downloadConversation/);
assert.match(s,/application\\/json/);
assert.match(s,/URL\\.createObjectURL/);
assert.match(s,/URL\\.revokeObjectURL/);
assert.match(s,/buildForkSnapshot/);
console.log('conversation fork backup: ok');