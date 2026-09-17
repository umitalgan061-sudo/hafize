// The bulk tag editor: wiring, bounds and the tag normalizer.
//
// The module shipped without ever being loaded by the page and with an empty
// stylesheet, so its dialog would have rendered as a plain block at the end of
// the document. This suite pins both the wiring and the behaviour that makes the
// editor safe to run over a selection.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertShellAssets, assertShellCacheContract } from './shell-cache-contract.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const source = read('public/prompt-library-bulk-organizer.js');
const css = read('public/prompt-library-bulk-organizer.css');
const html = read('public/index.html');

/* The page loads it, and it survives offline ------------------------------ */

assert.match(html, /<script src="\/prompt-library-bulk-organizer\.js" defer><\/script>/, 'the organizer is loaded by index.html');
assert.match(html, /<link rel="stylesheet" href="\/prompt-library-bulk-organizer\.css" \/>/, 'the organizer stylesheet is linked');
assert.ok(
  html.indexOf('/prompt-library-enhancements.js') < html.indexOf('/prompt-library-bulk-organizer.js'),
  'the toolbar it hangs off is created first'
);
assertShellCacheContract();
assertShellAssets(['/prompt-library-bulk-organizer.js', '/prompt-library-bulk-organizer.css'], 'bulk organizer asset');

/* The dialog is a real modal, not a block at the end of the page ---------- */

assert.match(css, /\.prompt-library-bulk-organizer \{[^}]*position: fixed/, 'the overlay is fixed');
assert.match(css, /inset: 0/);
assert.match(css, /z-index: 1000/);
assert.match(css, /@media \(forced-colors: active\)/, 'forced colours keep the panel readable');
assert.match(css, /focus-visible/, 'keyboard focus is visible inside the dialog');

/* Accessibility and teardown contracts ----------------------------------- */

for (const contract of [
  /setAttribute\('role', 'dialog'\)/,
  /setAttribute\('aria-modal', 'true'\)/,
  /setAttribute\('aria-labelledby', 'promptLibraryBulkTitle'\)/,
  /event\.key === 'Escape'/,
  /observer\?\.disconnect\?\.\(\)/,
  /MutationObserver/
]) assert.match(source, contract, `organizer contract ${contract} missing`);

assert.doesNotMatch(source, /innerHTML\s*=/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);

/* The tag normalizer ------------------------------------------------------ */

require('../public/prompt-library-bulk-organizer.js');
const organizer = globalThis.HafizePromptLibraryBulkOrganizer;
assert.ok(organizer?.normalizeTags, 'the organizer installs itself on the global');
assert.equal(organizer.LIMITS.MAX_TAGS, 8);
assert.equal(organizer.LIMITS.MAX_TAG, 24);
assert.equal(organizer.LIMITS.MAX_SELECTION, 40);

assert.deepEqual(organizer.normalizeTags(['yazma', ' düzenleme ', 'yazma']), ['yazma', 'düzenleme'], 'duplicates and padding are dropped');
assert.deepEqual(organizer.normalizeTags(['ÇALIŞMA', 'çalışma']), ['ÇALIŞMA'], 'the duplicate check is case insensitive in Turkish');
assert.deepEqual(organizer.normalizeTags(['', '   ', null, undefined]), [], 'empty values never become tags');
assert.deepEqual(organizer.normalizeTags(['a,b\nc']), ['a b c'], 'separators inside a tag become spaces');
assert.equal(organizer.normalizeTags(['x'.repeat(200)])[0].length, 24, 'a tag is bounded');
assert.equal(organizer.normalizeTags(Array.from({ length: 40 }, (_, index) => `tag-${index}`)).length, 8, 'the tag list is bounded');

/* Mounting without a page is a no-op, not a crash ------------------------- */

assert.equal(organizer.mount(), null);

console.log('prompt library bulk organizer: loaded by the page, cached offline, bounded tags');
