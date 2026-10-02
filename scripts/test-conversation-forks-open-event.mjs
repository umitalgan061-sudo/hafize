import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/hafize:open-conversation/);
assert.match(s,/activeConversationId = conversationId/);
assert.match(s,/conversationId.*string/);
console.log('conversation fork open event: ok');