import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const forks = readFileSync('public/typed/conversation-forks.ts', 'utf8');
const core = readFileSync('public/typed/conversation-fork-core.ts', 'utf8');

assert.match(forks, /function downloadConversation/);
assert.match(forks, /application\/json/);
assert.match(forks, /URL\.createObjectURL/);
assert.match(forks, /URL\.revokeObjectURL/);
assert.match(forks, /buildForkSnapshot/);
assert.match(core, /export function buildForkSnapshot/);
assert.match(core, /hafize-conversation-fork/);

console.log('conversation fork backup: ok');
