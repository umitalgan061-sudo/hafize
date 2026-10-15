import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/openDialog/); assert.match(s,/Yeni dal oluştur/); assert.match(s,/writeConversations/);
assert.match(s,/onConfirm/);
console.log('conversation fork confirmation: ok');