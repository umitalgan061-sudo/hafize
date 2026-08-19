import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');

function conversation(id, content, role = 'user') {
  return {
    id,
    title: `Başlık ${id}`,
    messages: [{ id: `m-${id}`, role, content }]
  };
}

const oversized = search.buildCanonicalIndex([
  conversation('first', 'a'.repeat(search.MAX_INDEXED_CONVERSATION_CHARS + 50)),
  conversation('second', 'needle-after-limit')
]);
assert.equal(oversized.get('first').length <= search.MAX_INDEXED_CONVERSATION_CHARS, true);
assert.equal(oversized.get('first').includes('a'.repeat(100)), true);
assert.equal(oversized.get('first').includes('needle-after-limit'), false);

const many = Array.from({ length: search.MAX_INDEXED_CONVERSATIONS + 5 }, (_, index) => (
  conversation(`conv-${index}`, `message-${index}`)
));
const bounded = search.buildCanonicalIndex(many);
assert.equal(bounded.size, search.MAX_INDEXED_CONVERSATIONS);
assert.equal(bounded.has(`conv-${search.MAX_INDEXED_CONVERSATIONS}`), false);

const roleFiltered = search.buildCanonicalIndex([
  {
    id: 'roles',
    title: 'Role Test',
    messages: [
      { role: 'user', content: 'allowed-user' },
      { role: 'assistant', content: 'allowed-assistant' },
      { role: 'system', content: 'blocked-system' },
      { role: 'developer', content: 'blocked-developer' },
      { role: 'tool', content: 'blocked-tool' }
    ]
  }
]);
assert.match(roleFiltered.get('roles'), /allowed-user/);
assert.match(roleFiltered.get('roles'), /allowed-assistant/);
assert.doesNotMatch(roleFiltered.get('roles'), /blocked-system|blocked-developer|blocked-tool/);

const invalidIds = search.buildCanonicalIndex([
  conversation('../bad', 'must-not-index'),
  conversation('ok:id', 'safe-index'),
  conversation('ok:id', 'duplicate-must-not-replace')
]);
assert.equal(invalidIds.size, 1);
assert.match(invalidIds.get('ok:id'), /safe-index/);
assert.doesNotMatch(invalidIds.get('ok:id'), /duplicate-must-not-replace/);

const row = {
  dataset: { conversationId: 'ok:id' },
  hidden: false,
  querySelector: () => ({ textContent: 'Unrelated title' })
};
assert.equal(search.rowMatches(row, 'safe-index', invalidIds), true);
assert.equal(search.rowMatches(row, 'not-present', invalidIds), false);

const noContentIndex = new Map();
assert.equal(search.rowMatches(row, 'unrelated', noContentIndex), true);
assert.equal(search.rowMatches(row, 'safe-index', noContentIndex), false);

const tooLong = search.filterRows([row], 'q'.repeat(search.MAX_QUERY_CHARS + 1), invalidIds);
assert.equal(tooLong.ok, false);
assert.equal(tooLong.visible, 1);
assert.equal(row.hidden, false);

assert.equal(search.MAX_INDEXED_CONVERSATIONS, 30);
assert.equal(search.MAX_INDEXED_CONVERSATION_CHARS, 120_000);
assert.equal(search.MAX_INDEXED_TOTAL_CHARS, 1_200_000);

console.log('conversation content search boundary tests passed');