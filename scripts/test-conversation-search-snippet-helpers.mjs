import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/conversation-search-snippets.js');

assert.equal(api.normalizeId('abc:1'), 'abc:1');
assert.equal(api.normalizeId('../bad'), '');
assert.equal(api.normalizeQuery('  MerHaba   DÜNYA '), 'merhaba dünya');
assert.equal(api.normalizeQuery('x'.repeat(api.MAX_QUERY_CHARS + 1)), '');
assert.match(api.boundedWindow('önce hedef sonra', 'hedef'), /hedef/);

assert.equal(
  api.firstMessageSnippet({
    messages: [
      { role: 'tool', content: 'secret hedef' },
      { role: 'assistant', content: 'normal hedef' }
    ]
  }, 'hedef').startsWith('Hafize:'),
  true,
  'tool/system content does not become snippet text'
);

const conversations = Array.from({ length: api.MAX_CONVERSATIONS + 3 }, (_, index) => ({
  id: `c${index}`,
  messages: [{ role: 'user', content: 'aranan değer' }]
}));
assert.equal(api.buildSnippetIndex(conversations, 'aranan').size, api.MAX_CONVERSATIONS);

const tooManyMessages = {
  id: 'bounded',
  messages: [
    ...Array.from({ length: api.MAX_MESSAGES_PER_CONVERSATION }, () => ({ role: 'user', content: 'başka' })),
    { role: 'assistant', content: 'hedef yalnız limit dışında' }
  ]
};
assert.equal(api.firstMessageSnippet(tooManyMessages, 'hedef'), '');

let reads = 0;
const root = {
  localStorage: {
    getItem() {
      reads += 1;
      return JSON.stringify([{ id: 'c1', messages: [{ role: 'user', content: 'aranan' }] }]);
    }
  },
  HafizeConversationStorageGuard: {
    STORAGE_KEY: 'hafize.conversations.v1',
    sanitizeStoredValue(raw) { return { value: JSON.parse(raw) }; }
  }
};
assert.equal(api.readCanonicalConversations(root).length, 1);
assert.equal(reads, 1);
assert.deepEqual(api.readCanonicalConversations({}), []);

const host = { textContent: 'önce', hidden: true };
const snapshot = api.snapshotNode(host);
host.textContent = 'sonra';
host.hidden = false;
api.restoreNode(host, snapshot);
assert.equal(host.textContent, 'önce');
assert.equal(host.hidden, true);
assert.equal(Object.isFrozen(snapshot), true);

console.log('conversation search snippet helper tests passed');
