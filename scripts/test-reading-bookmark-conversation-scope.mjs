import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const reading = require('../public/reading-focus.js');

function row({ active = false, id = '' } = {}) {
  return {
    dataset: id ? { conversationOrganizeId: id } : {},
    classList: { contains(name) { return name === 'active' && active; } }
  };
}

function documentFor(rows) {
  return {
    querySelectorAll(selector) {
      return selector === '#conversationList .conversation-row' ? rows : [];
    }
  };
}

const conversations = [
  { id: 'alpha', messages: [{ id: 'shared' }, { id: 'alpha-only' }] },
  { id: 'beta', messages: [{ id: 'shared' }, { id: 'beta-only' }] }
];

assert.equal(
  reading.activeConversationId(documentFor([
    row({ active: false, id: 'alpha' }),
    row({ active: true, id: 'beta' })
  ]), conversations),
  'beta',
  'organizer conversation identity must be authoritative'
);

assert.equal(
  reading.activeConversationId(documentFor([
    row({ active: true }),
    row({ active: false })
  ]), conversations),
  'alpha',
  'source order is allowed only before any organizer identity exists'
);

assert.equal(
  reading.activeConversationId(documentFor([
    row({ active: true }),
    row({ active: false, id: 'beta' })
  ]), conversations),
  null,
  'mixed tagged and untagged identity must fail closed'
);

assert.equal(
  reading.activeConversationId(documentFor([
    row({ active: true, id: 'alpha' }),
    row({ active: true, id: 'beta' })
  ]), conversations),
  null,
  'multiple active rows must fail closed'
);

assert.equal(
  reading.activeConversationId(documentFor([
    row({ active: true, id: 'missing' }),
    row({ active: false, id: 'beta' })
  ]), conversations),
  null,
  'unknown tagged conversation must never fall back to row position'
);

const index = reading.bookmarkIndexFromConversations(conversations);
assert.equal(index.validKeys.has(reading.bookmarkKey('alpha', 'shared')), true);
assert.equal(index.validKeys.has(reading.bookmarkKey('beta', 'shared')), true);
assert.notEqual(reading.bookmarkKey('alpha', 'shared'), reading.bookmarkKey('beta', 'shared'));
assert.equal(index.legacyMatches.get('shared'), null,
  'legacy shared id is ambiguous and must not be guessed into one conversation');
assert.deepEqual(reading.migrateLegacyBookmarkIds(['shared', 'alpha-only', 'beta-only'], index), [
  reading.bookmarkKey('alpha', 'alpha-only'),
  reading.bookmarkKey('beta', 'beta-only')
]);

const scoped = reading.scopeStateForConversations({
  focusMode: true,
  bookmarkIds: [
    reading.bookmarkKey('alpha', 'shared'),
    reading.bookmarkKey('beta', 'shared'),
    'deleted|message'
  ]
}, conversations);
assert.deepEqual(scoped, {
  focusMode: true,
  bookmarkIds: [reading.bookmarkKey('alpha', 'shared'), reading.bookmarkKey('beta', 'shared')],
  legacyBookmarkIds: []
});

console.log('reading bookmark conversation scope tests passed');
