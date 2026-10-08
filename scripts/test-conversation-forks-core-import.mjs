import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/conversation-fork-core\.ts/);
assert.match(s,/createFork/);
assert.match(s,/conversationLineage/);
console.log('conversation fork pure-core import: ok');
