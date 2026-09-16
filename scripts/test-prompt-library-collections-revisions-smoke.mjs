import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const html = read('public/index.html');
const sw = read('public/sw-policy.js');
const collections = read('public/prompt-library-collections.js');
const collectionEnh = read('public/prompt-library-collections-enhancements.js');
const revisions = read('public/prompt-library-revisions.js');
const revisionEnh = read('public/prompt-library-revisions-enhancements.js');
const css = read('public/prompt-library-collections.css');

const requiredHtmlAssets = [
  '/prompt-library-collections.css',
  '/prompt-library-revisions.css',
  '/prompt-library-collections.js',
  '/prompt-library-collections-enhancements.js',
  '/prompt-library-revisions.js',
  '/prompt-library-revisions-enhancements.js'
];
for (const asset of requiredHtmlAssets) assert.ok(html.includes(asset), `missing HTML asset: ${asset}`);
for (const asset of requiredHtmlAssets) assert.ok(sw.includes(asset), `missing shell asset: ${asset}`);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /return 'network-only'/);

assert.match(collections, /STORAGE_KEY = 'hafize\.prompt-library\.collections\.v1'/);
assert.match(collections, /PROMPT_KEY = 'hafize\.prompt-library\.v1'/);
assert.match(collections, /MAX_COLLECTIONS = 40/);
assert.match(collections, /MAX_MEMBERS = 120/);
assert.match(collections, /createCollection/);
assert.match(collections, /updateCollection/);
assert.match(collections, /deleteCollection/);
assert.match(collections, /setMembership/);
assert.match(collections, /addMembers/);
assert.match(collections, /removeMembers/);
assert.match(collections, /pruneMembers/);
assert.match(collections, /exportPayload/);
assert.match(collections, /importPayload/);
assert.match(collections, /promptIds: members/);
assert.match(collections, /new Set\(/);
assert.match(collections, /500_000/);
assert.match(collections, /aria-labelledby/);
assert.match(collections, /aria-label/);
assert.match(collections, /textContent/);

assert.match(revisions, /PROMPT_KEY = 'hafize\.prompt-library\.v1'/);
assert.match(revisions, /REVISION_KEY = 'hafize\.prompt-library\.revisions\.v1'/);
assert.match(revisions, /MAX_REVISIONS_PER_PROMPT = 20/);
assert.match(revisions, /MAX_REVISIONS_TOTAL = 600/);
assert.match(revisions, /normalizeSnapshot/);
assert.match(revisions, /normalizeRevision/);
assert.match(revisions, /sameContent/);
assert.match(revisions, /capture/);
assert.match(revisions, /pruneOrphans/);
assert.match(revisions, /before-restore/);
assert.match(revisions, /restore/);
assert.match(revisions, /useCount: current\.useCount/);
assert.match(revisions, /createdAt: current\.createdAt/);
assert.match(revisions, /aria-labelledby/);
assert.match(revisions, /aria-label/);
assert.match(revisions, /textContent/);

assert.match(collectionEnh, /createFromSelection/);
assert.match(collectionEnh, /duplicateCollection/);
assert.match(collectionEnh, /select-all/);
assert.match(collectionEnh, /clear-selection/);
assert.match(collectionEnh, /MAX_SELECTION = 40/);
assert.match(collectionEnh, /beforeunload/);
assert.match(revisionEnh, /open-current/);
assert.match(revisionEnh, /clear-history/);
assert.match(revisionEnh, /beforeunload/);

assert.match(css, /@media\(max-width:700px\)/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(css, /forced-colors:active/);
assert.match(css, /focus-visible/);

const secureSources = [collections, collectionEnh, revisions, revisionEnh];
for (const source of secureSources) {
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /outerHTML/);
  assert.doesNotMatch(source, /document\.write/);
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
  assert.doesNotMatch(source, /Authorization\s*:/);
  assert.doesNotMatch(source, /eval\(/);
  assert.doesNotMatch(source, /Function\(/);
}

const storageApiSignals = [
  /getItem/, /setItem/, /catch \{/, /return false;/, /return null;/
];
for (const signal of storageApiSignals) {
  assert.match(collections, signal);
  assert.match(revisions, signal);
}

assert.ok((collections.match(/promptIds/g) || []).length >= 5);
assert.ok((revisions.match(/revision/g) || []).length >= 15);
assert.ok((secureSources.join('\n').match(/textContent/g) || []).length >= 8);
assert.ok((secureSources.join('\n').match(/aria-label/g) || []).length >= 4);

console.log('prompt library collections/revisions release smoke: ok');
