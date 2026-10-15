import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/conversation-fork-core\.ts/);
assert.match(s,/createFork/);
assert.match(s,/conversationLineage/);
console.log('conversation fork pure-core import: ok');