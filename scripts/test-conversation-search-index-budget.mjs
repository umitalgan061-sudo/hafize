import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const search = require('../public/conversation-search.js');

function makeConversation(index, messageCount = 200) {
  return {
    id: `budget-${index}`,
    title: `Sohbet ${index}`,
    messages: Array.from({ length: messageCount }, (_, messageIndex) => ({
      id: `m-${index}-${messageIndex}`,
      role: messageIndex % 2 ? 'assistant' : 'user',
      content: `${index}-${messageIndex}-` + 'ğ'.repeat(650)
    }))
  };
}

const index = search.buildCanonicalIndex(
  Array.from({ length: search.MAX_INDEXED_CONVERSATIONS }, (_, conversationIndex) => makeConversation(conversationIndex))
);
assert.equal(index.size, search.MAX_INDEXED_CONVERSATIONS);

let totalChars = 0;
for (const [id, text] of index) {
  assert.match(id, /^budget-\d+$/);
  assert.equal(typeof text, 'string');
  assert.notEqual(text, '');
  assert.equal(text.length <= search.MAX_INDEXED_CONVERSATION_CHARS, true);
  totalChars += text.length;
}
assert.equal(totalChars <= search.MAX_INDEXED_TOTAL_CHARS, true);

const twoPart = search.buildCanonicalIndex([{
  id: 'two-part',
  title: '',
  messages: [
    { role: 'user', content: 'a'.repeat(70_000) },
    { role: 'assistant', content: 'needle-' + 'b'.repeat(70_000) }
  ]
}]).get('two-part');
assert.equal(twoPart.length, search.MAX_INDEXED_CONVERSATION_CHARS);
assert.equal(twoPart.includes('needle-'), true);
assert.equal(twoPart.includes('\n'), false, 'normalization may collapse separator whitespace but must preserve content');

const row = {
  dataset: { conversationId: 'two-part' },
  hidden: false,
  querySelector: () => ({ textContent: 'başka başlık' })
};
const budgetIndex = new Map([['two-part', twoPart]]);
assert.equal(search.rowMatches(row, 'needle-', budgetIndex), true);

const separatorOnlyPressure = search.buildCanonicalIndex([{
  id: 'many-small-parts',
  title: 't',
  messages: Array.from({ length: 200 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user',
    content: `p${i}`
  }))
}]).get('many-small-parts');
assert.match(separatorOnlyPressure, /p0/);
assert.match(separatorOnlyPressure, /p199/);
assert.equal(separatorOnlyPressure.length < search.MAX_INDEXED_CONVERSATION_CHARS, true);

console.log('conversation search index budget tests passed');
