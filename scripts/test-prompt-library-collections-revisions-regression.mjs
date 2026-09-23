import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = {
  collections: fs.readFileSync('public/prompt-library-collections.js', 'utf8'),
  revisions: fs.readFileSync('public/prompt-library-revisions.js', 'utf8'),
  collectionEnh: fs.readFileSync('public/prompt-library-collections-enhancements.js', 'utf8'),
  revisionEnh: fs.readFileSync('public/prompt-library-revisions-enhancements.js', 'utf8'),
  html: fs.readFileSync('public/index.html', 'utf8'),
  sw: fs.readFileSync('public/sw-policy.js', 'utf8')
};

assert.match(files.html, /prompt-library-collections\.css/);
assert.match(files.html, /prompt-library-revisions\.css/);
assert.match(files.html, /prompt-library-collections\.js/);
assert.match(files.html, /prompt-library-collections-enhancements\.js/);
assert.match(files.html, /prompt-library-revisions\.js/);
assert.match(files.html, /prompt-library-revisions-enhancements\.js/);
assert.match(files.sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'shell cache stays versioned');
for (const asset of [
  '/prompt-library-collections.css',
  '/prompt-library-revisions.css',
  '/prompt-library-collections.js',
  '/prompt-library-collections-enhancements.js',
  '/prompt-library-revisions.js',
  '/prompt-library-revisions-enhancements.js'
]) assert.match(files.sw, new RegExp(asset.replaceAll('.', '\\.')));

assert.match(files.collections, /hafize\.prompt-library\.collections\.v1/);
assert.match(files.revisions, /hafize\.prompt-library\.revisions\.v1/);
assert.match(files.collections, /pruneMembers/);
assert.match(files.revisions, /pruneOrphans/);
assert.match(files.revisions, /before-restore/);
assert.match(files.collectionEnh, /Seçilenlerden koleksiyon/);
assert.match(files.revisionEnh, /Geçmişi temizle/);

for (const source of Object.values(files)) {
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
}

assert.match(files.collections, /textContent/);
assert.match(files.revisions, /textContent/);
assert.doesNotMatch(files.collections, /innerHTML\s*=/);
assert.doesNotMatch(files.revisions, /innerHTML\s*=/);

console.log('prompt library collections/revisions regression: ok');
