import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// A fork copies the source messages up to and including the fork point, and
// records the parent. Both are the core's job; the DOM layer only passes the
// source through and never mutates it.
const core = readFileSync('public/typed/conversation-fork-core.ts','utf8');
const ui = readFileSync('public/typed/conversation-forks.ts','utf8');

assert.match(core,/source\.messages\.slice\(0, index \+ 1\)/);
assert.match(core,/forkOf/);
assert.match(core,/forkMessageId/);

assert.match(ui,/const freshSource = latest\.find\(\(item\) => item\.id === source\.id\)/);
assert.match(ui,/makeFork\(freshSource, messageId, latest/);
assert.match(ui,/const next = \[created\.conversation, \.\.\.latest\]/);
console.log('conversation fork parent preservation: ok');
