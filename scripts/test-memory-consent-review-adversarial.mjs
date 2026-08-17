import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const consent = require('../public/memory-consent-review.js');

const htmlLike = '<img src=x onerror="alert(1)"> & <script>no()</script>';
const snapshot = consent.buildReviewSnapshot('note', htmlLike);
assert.ok(snapshot);
assert.equal(snapshot.content, htmlLike, 'review must treat markup-shaped memory as inert text, not rewrite it');
assert.equal(snapshot.preview, htmlLike);
assert.equal(consent.sameSnapshot(snapshot, 'note', htmlLike), true);
assert.equal(consent.sameSnapshot(snapshot, 'note', `${htmlLike} `), true, 'outer whitespace normalization is stable');
assert.equal(consent.sameSnapshot(snapshot, 'note', htmlLike.replace('no()', 'yes()')), false);

const unicode = 'Ankara 🏙️ · tenis 🎾 · Türkçe İıŞşĞğ';
const unicodeSnapshot = consent.buildReviewSnapshot('preference', unicode);
assert.equal(unicodeSnapshot.content, unicode);
assert.equal(unicodeSnapshot.characters, unicode.length);

const exactLimit = 'ü'.repeat(consent.MAX_CONTENT_CHARS);
assert.equal(consent.buildReviewSnapshot('project', exactLimit)?.content.length, consent.MAX_CONTENT_CHARS);
assert.equal(consent.buildReviewSnapshot('project', `${exactLimit}ü`), null);

const previewBoundary = 'x'.repeat(consent.MAX_PREVIEW_CHARS);
assert.equal(consent.buildReviewSnapshot('note', previewBoundary).preview, previewBoundary);
const truncated = consent.buildReviewSnapshot('note', `${previewBoundary}y`).preview;
assert.equal(truncated.length, consent.MAX_PREVIEW_CHARS);
assert.equal(truncated.endsWith('…'), true);

for (const id of [
  'memory_../../secret',
  'memory_abcdefgh?x=1',
  'memory_abcdefgh#x',
  'memory_abcdefgh%2Fsecret',
  'memory_abc defgh',
  'MEMORY_abcdefgh',
  'memory_abcdefgh\n'
]) {
  assert.equal(consent.normalizeMemoryId(id), null, `unsafe memory id must fail closed: ${JSON.stringify(id)}`);
}

const first = consent.buildReviewSnapshot('identity', 'Adım Ümit.');
assert.equal(consent.sameSnapshot(first, 'preference', first.content), false, 'kind changes require a new review');
assert.equal(consent.sameSnapshot(first, 'identity', 'Adım Ümit!'), false, 'content changes require a new review');
assert.equal(consent.sameSnapshot(first, 'identity', '  Adım Ümit.  '), true, 'equivalent trimmed input may retain review');

for (const value of [undefined, null, 0, false, {}, [], () => {}]) {
  assert.equal(consent.normalizeContent(value), null);
}

console.log('memory consent adversarial tests passed');
