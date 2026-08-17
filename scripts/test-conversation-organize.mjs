import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const organize = require('../public/conversation-organize.js');

assert.equal(organize.SOURCE_KEY, 'hafize.conversations.v1');
assert.equal(organize.STORAGE_KEY, 'hafize.conversation-organize.v1');
assert.equal(organize.MAX_ENTRIES, 30);
assert.equal(organize.MAX_ID_CHARS, 160);
assert.equal(organize.MAX_TITLE_CHARS, 80);

assert.equal(organize.normalizeConversationId('abc-123_x:y.z'), 'abc-123_x:y.z');
assert.equal(organize.normalizeConversationId('  abc  '), 'abc');
assert.equal(organize.normalizeConversationId(''), null);
assert.equal(organize.normalizeConversationId('bad id'), null);
assert.equal(organize.normalizeConversationId('../bad'), null);
assert.equal(organize.normalizeConversationId('x'.repeat(161)), null);
assert.equal(organize.normalizeConversationId(null), null);

assert.equal(organize.normalizeTitle('  Ankara   planı  '), 'Ankara planı');
assert.equal(organize.normalizeTitle('x'.repeat(80)), 'x'.repeat(80));
assert.equal(organize.normalizeTitle('x'.repeat(81)), null);
assert.equal(organize.normalizeTitle('   '), null);
assert.equal(organize.normalizeTitle(null), null);

assert.deepEqual(
  organize.normalizeEntry({ id: 'a', title: ' Özel   başlık ', pinned: true }),
  { id: 'a', title: 'Özel başlık', pinned: true }
);
assert.deepEqual(organize.normalizeEntry({ id: 'a', pinned: false }), { id: 'a', title: null, pinned: false });
assert.equal(organize.normalizeEntry({ id: 'bad id', title: 'x' }), null);
assert.equal(organize.normalizeEntry({ id: 'a', title: 'x'.repeat(81) }), null);
assert.equal(organize.normalizeEntry(null), null);

const normalized = organize.normalizeEntries([
  { id: 'a', title: 'Bir', pinned: true },
  { id: 'a', title: 'İki', pinned: false },
  { id: 'b', title: null, pinned: false },
  { id: 'bad id', title: 'Bad' }
]);
assert.deepEqual(normalized, [
  { id: 'a', title: 'Bir', pinned: true },
  { id: 'b', title: null, pinned: false }
]);

assert.deepEqual(organize.parseEntries('{bad json'), []);
assert.deepEqual(organize.parseEntries(''), []);
assert.deepEqual(JSON.parse(organize.serializeEntries(normalized)), normalized);

let entries = [];
entries = organize.mergeEntry(entries, 'a', { pinned: true });
assert.deepEqual(entries, [{ id: 'a', title: null, pinned: true }]);
entries = organize.mergeEntry(entries, 'a', { title: 'Kritik konuşma' });
assert.deepEqual(entries, [{ id: 'a', title: 'Kritik konuşma', pinned: true }]);
entries = organize.mergeEntry(entries, 'a', { pinned: false });
assert.deepEqual(entries, [{ id: 'a', title: 'Kritik konuşma', pinned: false }]);
entries = organize.mergeEntry(entries, 'a', { title: null });
assert.deepEqual(entries, [], 'empty metadata must be removed');

const invalidPatchSource = [{ id: 'a', title: 'Korunmalı', pinned: false }];
assert.deepEqual(
  organize.mergeEntry(invalidPatchSource, 'a', { title: 'x'.repeat(81) }),
  invalidPatchSource,
  'invalid title must fail closed without destroying prior state'
);
assert.deepEqual(organize.mergeEntry(invalidPatchSource, 'bad id', { pinned: true }), invalidPatchSource);

const thirtyFive = Array.from({ length: 35 }, (_, index) => ({
  id: `id-${index}`,
  title: `Başlık ${index}`,
  pinned: index % 2 === 0
}));
assert.equal(organize.normalizeEntries(thirtyFive).length, 30);

const pruned = organize.pruneEntries([
  { id: 'a', title: 'A', pinned: true },
  { id: 'b', title: 'B', pinned: false },
  { id: 'c', title: 'C', pinned: true }
], ['c', 'a']);
assert.deepEqual(pruned, [
  { id: 'a', title: 'A', pinned: true },
  { id: 'c', title: 'C', pinned: true }
]);

assert.deepEqual(
  organize.sortIds(['a', 'b', 'c', 'd'], [
    { id: 'b', title: null, pinned: true },
    { id: 'd', title: 'D', pinned: true }
  ]),
  ['b', 'd', 'a', 'c'],
  'pinned rows must lead while preserving source order inside each group'
);
assert.deepEqual(organize.sortIds(['a', 'b'], []), ['a', 'b']);

const sourceStorage = {
  getItem(key) {
    assert.equal(key, organize.SOURCE_KEY);
    return JSON.stringify([
      { id: 'a', title: ' İlk   sohbet ' },
      { id: 'b', title: '' },
      { id: 'a', title: 'duplicate' },
      { id: 'bad id', title: 'ignored' }
    ]);
  }
};
assert.deepEqual(organize.readSourceConversations(sourceStorage), [
  { id: 'a', title: 'İlk sohbet' },
  { id: 'b', title: 'Yeni sohbet' }
]);
assert.deepEqual(organize.readSourceConversations({ getItem() { return '{bad'; } }), []);
assert.deepEqual(organize.readSourceConversations({ getItem() { return '{}'; } }), []);

console.log('conversation organize helper tests passed');
