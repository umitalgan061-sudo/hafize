import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/detail: \{ conversationId/); assert.match(s,/detail: \{ conversationId: freshSource\.id, forkId/);
console.log('conversation fork event payloads: ok');