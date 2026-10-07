import assert from 'node:assert/strict';
import fs from 'node:fs';

import { assertModuleDelivered } from './shell-cache-contract.mjs';
const files = {
  collections: fs.readFileSync('public/typed/legacy/prompt-library-collections.ts', 'utf8'),
  revisions: fs.readFileSync('public/typed/legacy/prompt-library-revisions.ts', 'utf8'),
  collectionEnh: fs.readFileSync('public/typed/legacy/prompt-library-collections-enhancements.ts', 'utf8'),
  revisionEnh: fs.readFileSync('public/typed/legacy/prompt-library-revisions-enhancements.ts', 'utf8'),
  html: fs.readFileSync('public/index.html', 'utf8'),
  sw: fs.readFileSync('public/sw-policy.ts', 'utf8')
};

assert.match(files.html, /prompt-library-collections\.css/);
assert.match(files.html, /prompt-library-revisions\.css/);
assertModuleDelivered('prompt-library-collections');
assertModuleDelivered('prompt-library-collections-enhancements');
assertModuleDelivered('prompt-library-revisions');
assertModuleDelivered('prompt-library-revisions-enhancements');
// The shell cache version is bumped on every shell change, so a literal version
// turns an unrelated change into a failure here. The invariant is what matters.
assert.match(files.sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'shell cache name carries a numeric version');
for (const asset of [
  '/prompt-library-collections.css',
  '/prompt-library-revisions.css'
]) assert.match(files.sw, new RegExp(asset.replaceAll('.', '\\.')));
// The four modules are bundled into the single legacy entry, so their
// pre-migration filenames no longer appear in the page or the shell list;
// assertModuleDelivered() checks the entry that carries each of them.
for (const name of [
  'prompt-library-collections',
  'prompt-library-collections-enhancements',
  'prompt-library-revisions',
  'prompt-library-revisions-enhancements',
]) assertModuleDelivered(name);


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
