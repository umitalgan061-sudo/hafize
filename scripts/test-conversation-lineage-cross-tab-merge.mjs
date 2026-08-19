import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lineage = require('../public/conversation-branch-lineage.js');

function conv(id, sourceIds = []) {
  return { id, messages: sourceIds.map((idValue) => ({ id: idValue, role: 'user', content: `content:${idValue}` })) };
}
function edge(child, createdAt, source = 'source') {
  return { childConversationId: child, parentConversationId: 'parent', sourceMessageId: source, mode: 'fork', createdAt };
}

const conversations = [conv('parent', ['source']), conv('child-a', ['a']), conv('child-b', ['b']), conv('child-c', ['c'])];
const index = lineage.buildConversationIndex(conversations);
const a = edge('child-a', '2026-08-19T01:00:00.000Z');
const b = edge('child-b', '2026-08-19T01:01:00.000Z');
const c = edge('child-c', '2026-08-19T01:02:00.000Z');

assert.deepEqual(lineage.mergeEntries([a], [b], index).map((item) => item.childConversationId), ['child-b', 'child-a']);
assert.deepEqual(lineage.mergeEntries([b], [a], index).map((item) => item.childConversationId), ['child-b', 'child-a'], 'merge order is deterministic');
assert.deepEqual(lineage.mergeEntries([a, c], [b], index).map((item) => item.childConversationId), ['child-c', 'child-b', 'child-a']);

const sameChildOlder = edge('child-a', '2026-08-19T00:00:00.000Z');
const mergedDuplicate = lineage.mergeEntries([sameChildOlder], [a], index);
assert.equal(mergedDuplicate.length, 1);
assert.equal(mergedDuplicate[0].createdAt, a.createdAt, 'newer duplicate child wins deterministically');

const stale = edge('child-a', '2026-08-19T03:00:00.000Z', 'expired-source');
assert.deepEqual(lineage.mergeEntries([stale], [b], index).map((item) => item.childConversationId), ['child-b'], 'source-retention guard applies during merge');

const tieA = edge('child-a', '2026-08-19T04:00:00.000Z');
const tieB = edge('child-b', '2026-08-19T04:00:00.000Z');
assert.deepEqual(lineage.mergeEntries([tieB], [tieA], index).map((item) => item.childConversationId), ['child-a', 'child-b']);

const floodConversations = [conv('parent', ['source'])];
const flood = [];
for (let i = 0; i < 80; i += 1) {
  const child = `child-${String(i).padStart(2, '0')}`;
  floodConversations.push(conv(child, [`m-${i}`]));
  flood.push(edge(child, new Date(Date.UTC(2026, 7, 19, 1, i)).toISOString()));
}
const floodIndex = lineage.buildConversationIndex(floodConversations);
const bounded = lineage.mergeEntries(flood.slice(0, 40), flood.slice(40), floodIndex);
assert.equal(bounded.length, lineage.MAX_ENTRIES);
assert.equal(new Set(bounded.map((item) => item.childConversationId)).size, lineage.MAX_ENTRIES);
assert.equal(bounded[0].childConversationId, 'child-79');

const secret = 'SECRET_DO_NOT_PERSIST';
const secretIndex = lineage.buildConversationIndex([
  { id: 'parent', messages: [{ id: 'source', role: 'user', content: secret }] },
  conv('child-a', ['a'])
]);
assert.equal(JSON.stringify(lineage.mergeEntries([a], [], secretIndex)).includes(secret), false);

console.log('conversation lineage cross-tab merge: ok');
