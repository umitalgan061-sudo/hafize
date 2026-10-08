import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/forkOf/); assert.match(s,/forkMessageId/); assert.match(s,/forkDepth/);
assert.match(s,/MAX_MESSAGE_LENGTH = 12000/);
console.log('conversation fork data contract: ok');