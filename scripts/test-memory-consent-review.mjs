import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const review = require('../public/memory-consent-review.js');

assert.equal(review.MAX_CONTENT_CHARS, 4000);
assert.equal(review.MAX_PREVIEW_CHARS, 240);
assert.equal(review.DELETE_CONFIRM_MS, 8000);
assert.deepEqual([...review.KINDS], ['identity', 'preference', 'project', 'note']);

for (const kind of review.KINDS) assert.equal(review.normalizeKind(kind), kind);
for (const invalid of ['', 'secret', 'system', null, {}, []]) assert.equal(review.normalizeKind(invalid), null);

assert.equal(review.normalizeContent('  Ankara tercihim  '), 'Ankara tercihim');
assert.equal(review.normalizeContent(''), null);
assert.equal(review.normalizeContent('   '), null);
assert.equal(review.normalizeContent(null), null);
assert.equal(review.normalizeContent('x'.repeat(4000)), 'x'.repeat(4000));
assert.equal(review.normalizeContent('x'.repeat(4001)), null);

const short = review.buildReviewSnapshot('preference', '  Tenis oynamayı seviyorum.  ');
assert.deepEqual(short, {
  kind: 'preference',
  content: 'Tenis oynamayı seviyorum.',
  preview: 'Tenis oynamayı seviyorum.',
  characters: 25
});
assert.equal(Object.isFrozen(short), true);

const longText = 'a'.repeat(300);
const long = review.buildReviewSnapshot('note', longText);
assert.equal(long.content, longText);
assert.equal(long.preview.length, 240);
assert.equal(long.preview.endsWith('…'), true);
assert.equal(long.characters, 300);

assert.equal(review.buildReviewSnapshot('secret', 'x'), null);
assert.equal(review.buildReviewSnapshot('note', ''), null);
assert.equal(review.sameSnapshot(short, 'preference', 'Tenis oynamayı seviyorum.'), true);
assert.equal(review.sameSnapshot(short, 'note', 'Tenis oynamayı seviyorum.'), false);
assert.equal(review.sameSnapshot(short, 'preference', 'Tenis oynamayı seviyorum!'), false);
assert.equal(review.sameSnapshot(null, 'note', 'x'), false);

assert.equal(review.normalizeMemoryId('memory_abcdEF12'), 'memory_abcdEF12');
assert.equal(review.normalizeMemoryId('memory_12345678-_.abc'), 'memory_12345678-_.abc');
for (const invalid of ['memory_short', 'other_abcdefgh', 'memory_abc/defgh', '', null]) {
  assert.equal(review.normalizeMemoryId(invalid), null);
}

console.log('memory consent review helper tests passed');
