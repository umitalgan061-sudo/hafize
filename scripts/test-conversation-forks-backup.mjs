import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/typed/conversation-forks.ts', 'utf8');

assert.match(source, /downloadConversation/);
assert.match(source, /application\/json/);
assert.match(source, /URL\.createObjectURL/);
assert.match(source, /URL\.revokeObjectURL/);
assert.match(source, /buildForkSnapshot/);

console.log('conversation fork backup: ok');
