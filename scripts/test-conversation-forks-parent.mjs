// A fork copies the parent conversation up to and including the fork point and
// leaves the parent itself untouched. The suite drives `createFork` directly so
// a refactor of the UI module cannot make it pass vacuously.
import assert from 'node:assert/strict';

import { FORK_LIMITS, createFork } from '../public/typed/conversation-fork-core.ts';

let counter = 0;
const options = { idFactory: () => 'fork-' + (counter += 1), now: () => '2026-01-01T00:00:00.000Z' };

const source = {
  id: 'root',
  title: 'Kök sohbet',
  agentId: 'default',
  toolsEnabled: true,
  messages: [
    { id: 'm1', role: 'user', content: 'ilk soru' },
    { id: 'm2', role: 'assistant', content: 'ilk yanıt' },
    { id: 'm3', role: 'user', content: 'ikinci soru' },
    { id: 'm4', role: 'assistant', content: 'ikinci yanıt' }
  ]
};
const snapshot = JSON.parse(JSON.stringify(source));

const { conversation, error } = createFork(source, 'm2', [source], options);
assert.equal(error, undefined);

// Everything up to the fork point travels with the branch; nothing after it does.
assert.deepEqual(conversation.messages.map((message) => message.content), ['ilk soru', 'ilk yanıt']);
assert.equal(conversation.forkOf, 'root');
assert.equal(conversation.forkMessageId, 'm2');
assert.equal(conversation.forkDepth, 1);
assert.notEqual(conversation.id, source.id);
assert.equal(conversation.agentId, 'default');
assert.equal(conversation.toolsEnabled, true);

// The parent conversation is never mutated by a fork.
assert.deepEqual(source, snapshot);

// Forking the last message carries the whole thread.
const whole = createFork(source, 'm4', [source], options);
assert.equal(whole.error, undefined);
assert.equal(whole.conversation.messages.length, source.messages.length);

// Copied messages are detached from the parent objects.
assert.notEqual(whole.conversation.messages[0], source.messages[0]);

// A custom branch title and note stay bounded.
const titled = createFork(source, 'm1', [source], { ...options, title: 'x'.repeat(FORK_LIMITS.maxTitle + 40), note: 'n'.repeat(FORK_LIMITS.maxForkNote + 40) });
assert.equal(titled.conversation.title.length, FORK_LIMITS.maxTitle);
assert.equal(titled.conversation.forkNote.length, FORK_LIMITS.maxForkNote);

console.log('conversation fork parent preservation: ok');
