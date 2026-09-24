import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const collections = read('public/prompt-library-collections.js');
const collectionEnh = read('public/prompt-library-collections-enhancements.js');
const revisions = read('public/prompt-library-revisions.js');
const revisionEnh = read('public/prompt-library-revisions-enhancements.js');
const html = read('public/index.html');
const sw = read('public/sw-policy.js');
const collectionCss = read('public/prompt-library-collections.css');
const revisionCss = read('public/prompt-library-revisions.css');

const collectionApi = [
  'normalizeCollection',
  'normalizeCollections',
  'readCollections',
  'saveCollections',
  'pruneMembers',
  'createCollection',
  'updateCollection',
  'deleteCollection',
  'setMembership',
  'addMembers',
  'removeMembers',
  'exportPayload',
  'importPayload',
  'mount'
];
for (const name of collectionApi) assert.match(collections, new RegExp(name));

const revisionApi = [
  'normalizeSnapshot',
  'normalizeRevision',
  'readRevisions',
  'saveRevisions',
  'revisionsFor',
  'sameContent',
  'capture',
  'removePromptRevisions',
  'pruneOrphans',
  'restore',
  'exportPromptRevisions',
  'summarizeRevision',
  'mount'
];
for (const name of revisionApi) assert.match(revisions, new RegExp(name));

assert.match(collections, /STORAGE_KEY = 'hafize\.prompt-library\.collections\.v1'/);
assert.match(collections, /PROMPT_KEY = 'hafize\.prompt-library\.v1'/);
assert.match(revisions, /PROMPT_KEY = 'hafize\.prompt-library\.v1'/);
assert.match(revisions, /REVISION_KEY = 'hafize\.prompt-library\.revisions\.v1'/);

assert.match(collections, /MAX_COLLECTIONS = 40/);
assert.match(collections, /MAX_MEMBERS = 120/);
assert.match(revisions, /MAX_REVISIONS_PER_PROMPT = 20/);
assert.match(revisions, /MAX_REVISIONS_TOTAL = 600/);

assert.match(collections, /MAX_NAME = 80/);
assert.match(collections, /MAX_DESCRIPTION = 240/);
assert.match(collections, /MAX_QUERY = 100/);
assert.match(revisions, /MAX_TITLE = 100/);
assert.match(revisions, /MAX_BODY = 8000/);
assert.match(revisions, /MAX_TAGS = 8/);
assert.match(revisions, /MAX_TAG = 24/);
assert.match(revisions, /MAX_REASON = 160/);

assert.match(collections, /new Set\(/);
assert.match(collections, /existingNames/);
assert.match(collections, /promptIds\.filter/);
assert.match(revisions, /sameContent/);
assert.match(revisions, /before-restore/);
assert.match(revisions, /restore/);
assert.match(revisions, /useCount: current\.useCount/);
assert.match(revisions, /createdAt: current\.createdAt/);

assert.match(collectionEnh, /createFromSelection/);
assert.match(collectionEnh, /duplicateCollection/);
assert.match(collectionEnh, /select-all/);
assert.match(collectionEnh, /clear-selection/);
assert.match(collectionEnh, /MAX_SELECTION = 40/);
assert.match(collectionEnh, /beforeunload/);

assert.match(revisionEnh, /open-current/);
assert.match(revisionEnh, /clear-history/);
assert.match(revisionEnh, /beforeunload/);

for (const asset of [
  '/prompt-library-collections.css',
  '/prompt-library-revisions.css',
  '/prompt-library-collections.js',
  '/prompt-library-collections-enhancements.js',
  '/prompt-library-revisions.js',
  '/prompt-library-revisions-enhancements.js'
]) assert.ok(html.includes(asset), `HTML missing ${asset}`);

for (const asset of [
  '/prompt-library-collections.css',
  '/prompt-library-revisions.css',
  '/prompt-library-collections.js',
  '/prompt-library-collections-enhancements.js',
  '/prompt-library-revisions.js',
  '/prompt-library-revisions-enhancements.js'
]) assert.ok(sw.includes(asset), `SW missing ${asset}`);

assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /return 'network-only'/);

for (const css of [collectionCss, revisionCss]) {
  assert.match(css, /focus-visible/);
  assert.match(css, /max-width:700px/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /forced-colors:active/);
}

for (const source of [collections, collectionEnh, revisions, revisionEnh]) {
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /outerHTML/);
  assert.doesNotMatch(source, /document\.write/);
  assert.doesNotMatch(source, /navigator\.sendBeacon/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
  assert.doesNotMatch(source, /WebSocket/);
  assert.doesNotMatch(source, /Authorization\s*:/);
  assert.doesNotMatch(source, /document\.cookie/);
  assert.doesNotMatch(source, /eval\(/);
  assert.doesNotMatch(source, /Function\(/);
}

assert.match(collections, /textContent/);
assert.match(collectionEnh, /textContent/);
assert.match(revisions, /textContent/);
assert.match(revisionEnh, /textContent/);
assert.match(collections, /aria-label/);
assert.match(revisions, /aria-label/);
assert.match(collections, /aria-expanded/);
assert.match(revisions, /aria-expanded/);

assert.match(collections, /return false;/);
assert.match(collections, /return null;/);
assert.match(revisions, /return false;/);
assert.match(revisions, /return null;/);
assert.match(collections, /catch \{/);
assert.match(revisions, /catch \{/);

assert.match(collections, /JSON\.parse/);
assert.match(collections, /JSON\.stringify/);
assert.match(revisions, /JSON\.parse/);
assert.match(revisions, /JSON\.stringify/);

assert.doesNotMatch(collections, /setInterval\(/);
assert.doesNotMatch(revisions, /setInterval\(/);
assert.match(collections, /MutationObserver/);
assert.match(revisions, /MutationObserver/);
assert.match(collectionEnh, /MutationObserver/);
assert.match(revisionEnh, /MutationObserver/);

assert.match(collections, /destroy:/);
assert.match(revisions, /destroy:/);
assert.match(collectionEnh, /listeners\.splice/);
assert.match(revisionEnh, /listeners\.splice/);

console.log('prompt library collections/revisions contract gate: ok');
