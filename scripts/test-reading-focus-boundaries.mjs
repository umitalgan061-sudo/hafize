import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const focus = require('../public/reading-focus.js');

for (const invalid of [
  'a b',
  'a/b',
  'a\\b',
  '<a>',
  '"quoted"',
  "'quoted'",
  'emoji-★',
  'satır\nsonu',
  'tab\tkarakteri',
  'query?x=1',
  'hash#id',
  'percent%20id'
]) {
  assert.equal(focus.normalizeMessageId(invalid), null, `${JSON.stringify(invalid)} must be rejected`);
}

for (const valid of [
  '550e8400-e29b-41d4-a716-446655440000',
  'msg_123',
  'message.id',
  'message:id',
  'A-Z_0.9:x'
]) {
  assert.equal(focus.normalizeMessageId(valid), valid);
}

assert.deepEqual(
  focus.normalizeState({ focusMode: 'true', bookmarkIds: ['a'] }),
  { focusMode: false, bookmarkIds: ['a'] },
  'truthy strings must not enable focus mode'
);
assert.deepEqual(
  focus.normalizeState({ focusMode: 1, bookmarkIds: ['a'] }),
  { focusMode: false, bookmarkIds: ['a'] },
  'numeric truthy values must not enable focus mode'
);

const serialized = focus.serializeState({
  focusMode: true,
  bookmarkIds: ['safe-id'],
  messageText: 'çok gizli mesaj gövdesi',
  conversationTitle: 'özel başlık',
  token: 'secret-token'
});
const parsedSerialized = JSON.parse(serialized);
assert.deepEqual(Object.keys(parsedSerialized).sort(), ['bookmarkIds', 'focusMode']);
assert.deepEqual(parsedSerialized, { focusMode: true, bookmarkIds: ['safe-id'] });
assert.equal(serialized.includes('çok gizli'), false);
assert.equal(serialized.includes('özel başlık'), false);
assert.equal(serialized.includes('secret-token'), false);

const twoHundred = Array.from({ length: 200 }, (_, index) => `m-${index}`);
const moved = focus.nextBookmarkIds(twoHundred, 'm-0', true);
assert.equal(moved.length, 200);
assert.equal(moved.at(-1), 'm-0', 're-enabling an existing bookmark should move it to newest position');
assert.equal(new Set(moved).size, 200, 'bookmark set must remain unique');

const evicted = focus.nextBookmarkIds(twoHundred, 'm-new', true);
assert.equal(evicted.length, 200);
assert.equal(evicted[0], 'm-1');
assert.equal(evicted.at(-1), 'm-new');
assert.equal(evicted.includes('m-0'), false, 'oldest bookmark should be evicted at the bound');

const disabledUnknown = focus.nextBookmarkIds(['a', 'b'], 'c', false);
assert.deepEqual(disabledUnknown, ['a', 'b']);
const disabledKnown = focus.nextBookmarkIds(['a', 'b'], 'a', false);
assert.deepEqual(disabledKnown, ['b']);

const malformedCorpus = [
  ...Array.from({ length: 30 }, () => 'same'),
  ...Array.from({ length: 30 }, (_, index) => `ok-${index}`),
  ...Array.from({ length: 30 }, (_, index) => `bad id ${index}`),
  null,
  undefined,
  42,
  {},
  []
];
const normalizedCorpus = focus.normalizeBookmarkIds(malformedCorpus);
assert.equal(normalizedCorpus[0], 'same');
assert.equal(normalizedCorpus.filter((id) => id === 'same').length, 1);
assert.equal(normalizedCorpus.every((id) => focus.normalizeMessageId(id) === id), true);

const sourcePath = fileURLToPath(new URL('../public/reading-focus.js', import.meta.url));
const source = await readFile(sourcePath, 'utf8');
for (const forbidden of [
  /window\.location\s*=/,
  /location\.href\s*=/,
  /window\.open\s*\(/,
  /document\.write\s*\(/,
  /eval\s*\(/,
  /new\s+Function\b/,
  /postMessage\s*\(/,
  /BroadcastChannel\b/,
  /indexedDB\b/,
  /localStorage\.clear\s*\(/,
  /sessionStorage\.clear\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `forbidden reading-focus surface detected: ${forbidden}`);
}

assert.equal(source.includes("bookmarkFilter.setAttribute('aria-pressed'"), true);
assert.equal(source.includes("article.classList?.toggle?.('reading-bookmark-filtered-out'"), true);
assert.equal(source.includes("messages.classList?.toggle?.('reading-bookmark-filter-active'"), true);
assert.equal(source.includes('bookmarksOnly = false'), true, 'bookmark-only filter must remain ephemeral');
assert.equal(source.includes('bookmarkIds: Array.from(bookmarks), bookmarksOnly'), true, 'runtime snapshot should expose filter state without persisting it');

console.log('reading focus boundary tests passed');
