import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lineage = require('../public/conversation-branch-lineage.js');

function conversation(id, messageIds) {
  return {
    id,
    messages: messageIds.map((messageId) => ({ id: messageId, role: 'user', content: `content:${messageId}` }))
  };
}

function entry({ child = 'child-1', parent = 'parent-1', source = 'msg-1', mode = 'fork', createdAt = '2026-08-19T01:00:00.000Z' } = {}) {
  return { childConversationId: child, parentConversationId: parent, sourceMessageId: source, mode, createdAt };
}

const list = [conversation('parent-1', ['msg-1', 'msg-2']), conversation('child-1', ['child-msg-1'])];
const index = lineage.buildConversationIndex(list);
assert.equal(index.size, 2);
assert.deepEqual([...index.get('parent-1')], ['msg-1', 'msg-2']);
assert.ok(lineage.normalizeEntry(entry(), index), 'valid parent source anchor should survive');
assert.equal(lineage.normalizeEntry(entry({ source: 'expired-msg' }), index), null, 'missing source anchor must fail closed');
assert.equal(lineage.normalizeEntry(entry({ parent: 'missing-parent' }), index), null);
assert.equal(lineage.normalizeEntry(entry({ child: 'missing-child' }), index), null);

const legacySet = new Set(['parent-1', 'child-1']);
assert.ok(lineage.normalizeEntry(entry({ source: 'legacy-source' }), legacySet), 'Set-based pure helper compatibility remains conversation-only');

const inherited = Object.create({ id: 'prototype-message' });
inherited.role = 'user';
inherited.content = 'do not trust prototype id';
const inheritedIndex = lineage.buildConversationIndex([
  { id: 'parent-1', messages: [inherited] },
  conversation('child-1', ['child-msg'])
]);
assert.equal(lineage.normalizeEntry(entry({ source: 'prototype-message' }), inheritedIndex), null, 'prototype message IDs are not anchors');

const siblingEntries = [
  entry({ child: 'child-1', source: 'expired-msg', createdAt: '2026-08-19T01:00:00.000Z' }),
  entry({ child: 'child-2', source: 'expired-msg', createdAt: '2026-08-19T01:01:00.000Z' })
];
const siblingIndex = lineage.buildConversationIndex([
  conversation('parent-1', ['msg-1']),
  conversation('child-1', ['a']),
  conversation('child-2', ['b'])
]);
assert.deepEqual(lineage.normalizeEntries(siblingEntries, siblingIndex), [], 'all alternatives for an expired source are removed');

const validSiblingEntries = [
  entry({ child: 'child-1', source: 'msg-1', createdAt: '2026-08-19T01:00:00.000Z' }),
  entry({ child: 'child-2', source: 'msg-1', createdAt: '2026-08-19T01:01:00.000Z' })
];
const validSiblings = lineage.normalizeEntries(validSiblingEntries, siblingIndex);
assert.equal(validSiblings.length, 2);
assert.equal(lineage.resolveSiblings(validSiblings, 'child-1').nextConversationId, 'child-2');

const maxList = [];
for (let c = 0; c < 30; c += 1) {
  maxList.push(conversation(`conv-${c}`, Array.from({ length: 200 }, (_, m) => `msg-${c}-${m}`)));
}
const maxIndex = lineage.buildConversationIndex(maxList);
assert.equal(maxIndex.size, 30);
assert.equal([...maxIndex.values()].reduce((sum, ids) => sum + ids.size, 0), 6000, 'bounded canonical history indexes at most retained IDs');

console.log('conversation lineage source retention: ok');
