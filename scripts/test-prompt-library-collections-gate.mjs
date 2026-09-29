import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const source = read('public/prompt-library-collections.js');
const keyboard = read('public/prompt-library-collections-keyboard.js');
const css = read('public/prompt-library-collections.css');
const index = read('public/index.html');
const sw = read('public/sw-policy.js');
const readme = read('README.md');

assert.ok(source.includes("hafize.prompt-library.collections.v1"));
assert.ok(source.includes("hafize.prompt-library.collections.map.v1"));
assert.ok(source.includes("hafize.prompt-library.collections.default.v1"));

assert.ok(source.includes('MAX_COLLECTIONS = 24'));
assert.ok(source.includes('MAX_NAME = 36'));
assert.ok(source.includes('MAX_SELECTED = 40'));
assert.ok(source.includes('MAX_EXPORT = 500_000'));

assert.ok(source.includes('function normalizeCollection'));
assert.ok(source.includes('function normalizeImported'));
assert.ok(source.includes('function mergeImported'));
assert.ok(source.includes('function pruneMap'));

assert.ok(source.includes('validCollections'));
assert.ok(source.includes('validPrompts'));
assert.ok(source.includes('knownPromptIds'));

assert.ok(source.includes('function selectedPromptIds'));
assert.ok(source.includes('function bulkAssignPrompts'));
assert.ok(source.includes("id = 'promptLibraryCollectionBulkDestination'"));
assert.ok(source.includes("id = 'promptLibraryCollectionDefault'"));

assert.ok(source.includes('function applyFilterVisibility'));
assert.ok(source.includes('row.hidden = !collectionMatches'));
assert.ok(source.includes("filterId === NONE"));

assert.ok(source.includes('getCollectionForPrompt'));
assert.ok(source.includes('collectionMatches'));
assert.ok(source.includes('saveDefaultCollection'));

assert.ok(source.includes('textContent = String(value ?? \'\')'));
assert.ok(!source.includes('innerHTML'));
assert.ok(!source.includes('outerHTML'));
assert.ok(!source.includes('eval('));
assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('XMLHttpRequest'));
assert.ok(!source.includes('WebSocket'));

assert.ok(source.includes('FileReader'));
assert.ok(source.includes('selected.size'));
assert.ok(source.includes('URL.createObjectURL'));
assert.ok(source.includes('URL.revokeObjectURL'));

assert.ok(source.includes("role', 'list'"));
assert.ok(source.includes("role', 'listitem'"));
assert.ok(source.includes("aria-live', 'polite'"));
assert.ok(source.includes('aria-labelledby'));

assert.ok(keyboard.includes("FILTER_ID = 'promptLibraryCollectionFilter'"));
assert.ok(keyboard.includes('event.ctrlKey || event.metaKey'));
assert.ok(keyboard.includes('event.shiftKey'));
assert.ok(keyboard.includes("event.key.toLowerCase() !== 'o'"));
assert.ok(keyboard.includes('isEditable'));

assert.ok(css.includes('.prompt-library-collections'));
assert.ok(css.includes('@media (max-width:700px)'));
assert.ok(css.includes('@media (forced-colors:active)'));

assert.ok(index.includes('/prompt-library-collections.css'));
assert.ok(index.includes('/prompt-library-collections.js'));
assert.ok(index.includes('/prompt-library-collections-keyboard.js'));
assert.ok(index.indexOf('/prompt-library.js') < index.indexOf('/prompt-library-collections.js'));

assert.ok(sw.includes('/prompt-library-collections.css'));
assert.ok(sw.includes('/prompt-library-collections.js'));
assert.ok(sw.includes('/prompt-library-collections-keyboard.js'));

assert.ok(readme.includes('koleksiyon oluşturma'));
assert.ok(readme.includes('varsayılan koleksiyon'));

const docs = [
  'docs/PROMPT_LIBRARY_COLLECTIONS.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_DATA_MODEL.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_SECURITY.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_PRIVACY.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_ACCESSIBILITY.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_COMPATIBILITY.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_MIGRATION.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_OPERATIONS.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_QA.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_TEST_MATRIX.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_USER_GUIDE.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_RELEASE.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_ROLLBACK.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_THREAT_MODEL.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_DEFAULTS.md',
  'docs/PROMPT_LIBRARY_COLLECTIONS_FINAL_CHECK.md'
];

for (const path of docs) {
  const doc = read(path);
  assert.ok(doc.startsWith('#'), `documentation missing heading: ${path}`);
  assert.ok(doc.length > 300, `documentation too small: ${path}`);
}

console.log('prompt library collections regression gate: ok');
