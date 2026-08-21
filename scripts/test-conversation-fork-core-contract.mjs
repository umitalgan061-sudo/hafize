import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-fork.js');

assert.equal(api.STORAGE_KEY, 'hafize.conversations.v1');
assert.equal(api.BRANCH_EVENT, 'hafize:conversation-branched');
assert.equal(api.MARKER, 'hafizeForkReady');
assert.equal(typeof api.createController, 'function');

assert.equal(api.forkTitle('Sohbet'), 'Sohbet · dal');
assert.equal(api.forkTitle('   '), 'Yeni sohbet · dal');
assert.ok(api.forkTitle('x'.repeat(200), 30).length <= 30);

const source = {
  id: 'source',
  title: 'Kaynak',
  agentId: 'minimal-engineer',
  toolsEnabled: true,
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
  messages: [
    { id: 'u1', role: 'user', content: 'one' },
    { id: 'a1', role: 'assistant', content: 'two' },
    { id: 'u2', role: 'user', content: 'three' },
    { id: 'a2', role: 'assistant', content: 'four' }
  ]
};

assert.deepEqual(api.findSource([source], 'a1'), { conversation: source, index: 1 });
assert.equal(api.findSource([source], 'u1'), null, 'user messages are not fork anchors');
assert.equal(api.findSource([{ ...source }, { ...source, id: 'other' }], 'a1'), null, 'duplicate message ids fail closed');
assert.equal(api.findSource([], 'a1'), null);

assert.equal(api.includesConversationIds([{ id: 'a' }, { id: 'b' }], 'a', 'b'), true);
assert.equal(api.includesConversationIds([{ id: 'a' }], 'a', 'b'), false);
assert.equal(api.includesConversationIds([{ id: 'a' }], 'a', 'a'), false, 'duplicate required ids fail closed');
assert.equal(api.includesConversationIds(null, 'a'), false);

{
  let id = 0;
  const fork = api.buildFork(source, 1, {
    nowIso: '2026-08-21T08:00:00.000Z',
    makeId(prefix) { id += 1; return `${prefix}-${id}`; },
    maxTitleChars: 80
  });
  assert.ok(fork);
  assert.equal(fork.id, 'conversation-1');
  assert.equal(fork.title, 'Kaynak · dal');
  assert.equal(fork.agentId, 'minimal-engineer');
  assert.equal(fork.toolsEnabled, true);
  assert.equal(fork.messages.length, 2, 'fork includes context only through selected assistant message');
  assert.equal(fork.messages[0].role, 'user');
  assert.equal(fork.messages[1].role, 'assistant');
  assert.notEqual(fork.messages[0].id, source.messages[0].id, 'copied messages receive fresh ids');
  assert.equal(source.messages.length, 4, 'source transcript remains unchanged');
}

assert.equal(api.buildFork(source, 0, { nowIso: 'x', makeId: () => 'id' }), null, 'cannot fork on user message');
assert.equal(api.buildFork(source, 99, { nowIso: 'x', makeId: () => 'id' }), null);
assert.equal(api.buildFork(null, 1, { nowIso: 'x', makeId: () => 'id' }), null);
assert.equal(api.buildFork(source, 1, { nowIso: 'x', makeId: () => '' }), null, 'missing ids fail closed');

{
  let bytes = 0;
  const cryptoRef = {
    getRandomValues(target) {
      for (let i = 0; i < target.length; i += 1) target[i] = ++bytes;
      return target;
    }
  };
  const id = api.defaultId('conversation', cryptoRef);
  assert.match(id, /^conversation-[a-f0-9]{24}$/);
}

assert.equal(api.defaultId('conversation', {}), '');

console.log('conversation fork core contract tests passed');
