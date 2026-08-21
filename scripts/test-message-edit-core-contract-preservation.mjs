import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/message-edit.js');

assert.equal(api.STORAGE_KEY, 'hafize.conversations.v1');
assert.equal(api.DRAFT_HANDOFF_KEY, 'hafize.edit-branch-draft.v1');
assert.equal(api.BRANCH_EVENT, 'hafize:conversation-branched');
assert.equal(api.MAX_COMPOSER_CHARS, 12_000);
assert.equal(api.MAX_HANDOFF_AGE_MS, 90_000);

assert.equal(api.editableText('  Merhaba\r\ndünya  '), '  Merhaba\ndünya  ');
assert.equal(api.editableText('\u0000güvenli'), 'güvenli');
assert.equal(api.editableText('   '), null);
assert.equal(api.editableText('x'.repeat(api.MAX_COMPOSER_CHARS + 1)), null);
assert.equal(api.editableText(null), null);

{
  const cryptoRef = { randomUUID: () => 'uuid-1' };
  assert.equal(api.defaultId('conversation', cryptoRef), 'conversation-uuid-1');
  assert.equal(api.defaultId('', cryptoRef), '-uuid-1');
  assert.equal(api.defaultId('message', {}), '');
}

{
  const values = new Uint8Array(12).map((_value, index) => index);
  const cryptoRef = { getRandomValues(target) { target.set(values); return target; } };
  assert.equal(api.defaultId('message', cryptoRef), 'message-000102030405060708090a0b');
}

assert.equal(api.editBranchTitle('Başlık', 80), 'Başlık · düzenleme');
assert.ok(api.editBranchTitle('x'.repeat(200), 40).length <= 40);
assert.match(api.editBranchTitle('', 80), /^Yeni sohbet/);

const source = {
  id: 'source',
  title: 'Kaynak',
  agentId: 'minimal-engineer',
  toolsEnabled: true,
  messages: [
    { id: 'u1', role: 'user', content: 'bir' },
    { id: 'a1', role: 'assistant', content: 'iki' },
    { id: 'u2', role: 'user', content: 'üç' },
    { id: 'a2', role: 'assistant', content: 'dört' }
  ]
};

{
  const found = api.findSource([source], 'u2');
  assert.equal(found.conversation, source);
  assert.equal(found.index, 2);
  assert.equal(api.findSource([source], 'missing'), null);
  assert.equal(api.findSource([source, structuredClone(source)], 'u2'), null, 'ambiguous message id fails closed');
}

{
  let id = 0;
  const branch = api.buildEditBranch(source, 2, {
    nowIso: '2026-08-21T04:00:00.000Z',
    makeId: (prefix) => `${prefix}-${++id}`,
    maxTitleChars: 80
  });
  assert.ok(branch);
  assert.equal(branch.id, 'conversation-1');
  assert.equal(branch.agentId, source.agentId);
  assert.equal(branch.toolsEnabled, true);
  assert.equal(branch.messages.length, 2, 'edited user message and following assistant reply are excluded');
  assert.deepEqual(branch.messages.map((message) => message.role), ['user', 'assistant']);
  assert.notEqual(branch.messages[0].id, source.messages[0].id, 'copied context receives fresh ids');
  assert.equal(source.messages.length, 4, 'source conversation is not mutated');
  assert.equal(Object.prototype.hasOwnProperty.call(source, 'updatedAt'), false);
}

assert.equal(api.buildEditBranch(source, -1, { nowIso: 'x', makeId: () => 'id' }), null);
assert.equal(api.buildEditBranch(source, 1, { nowIso: 'x', makeId: () => 'id' }), null, 'assistant message cannot be edit source');
assert.equal(api.buildEditBranch(source, 2, { nowIso: '', makeId: () => 'id' }), null);
assert.equal(api.buildEditBranch(source, 2, { nowIso: 'x', makeId: () => '' }), null);

assert.equal(api.includesConversationIds([{ id: 'a' }, { id: 'b' }], 'a', 'b'), true);
assert.equal(api.includesConversationIds([{ id: 'a' }], 'a', 'b'), false);
assert.equal(api.includesConversationIds([{ id: 'a' }], 'a', 'a'), false, 'duplicate required ids fail closed');
assert.equal(api.includesConversationIds([], 'a'), false);

{
  const now = 1_800_000_000_000;
  const valid = api.normalizeHandoff({ conversationId: 'conversation-1', text: '  taslak  ', createdAt: now - 1_000 }, { nowMs: now });
  assert.deepEqual(valid, { conversationId: 'conversation-1', text: '  taslak  ', createdAt: now - 1_000 });
  assert.equal(Object.isFrozen(valid), true);
  assert.equal(api.normalizeHandoff({ conversationId: '../bad', text: 'x', createdAt: now }, { nowMs: now }), null);
  assert.equal(api.normalizeHandoff({ conversationId: 'ok', text: '', createdAt: now }, { nowMs: now }), null);
  assert.equal(api.normalizeHandoff({ conversationId: 'ok', text: 'x', createdAt: now + 1 }, { nowMs: now }), null, 'future handoff fails closed');
  assert.equal(api.normalizeHandoff({ conversationId: 'ok', text: 'x', createdAt: now - api.MAX_HANDOFF_AGE_MS - 1 }, { nowMs: now }), null);
  assert.ok(api.normalizeHandoff({ conversationId: 'ok', text: 'x', createdAt: now - api.MAX_HANDOFF_AGE_MS }, { nowMs: now }));
}

console.log('message edit core contract preservation tests passed');
