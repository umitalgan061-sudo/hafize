import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');
const collections = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
const revisions = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
const collectionEnh = fs.readFileSync('public/prompt-library-collections-enhancements.js', 'utf8');
const revisionEnh = fs.readFileSync('public/prompt-library-revisions-enhancements.js', 'utf8');
const css = fs.readFileSync('public/prompt-library-collections.css', 'utf8');

assert.match(html, /prompt-library-collections\.css/);
assert.match(html, /prompt-library-revisions\.css/);
assert.match(html, /prompt-library-collections\.js/);
assert.match(html, /prompt-library-collections-enhancements\.js/);
assert.match(html, /prompt-library-revisions\.js/);
assert.match(html, /prompt-library-revisions-enhancements\.js/);
// The panel id is declared once as a constant and applied from it.
assert.match(collections, /PANEL_ID = 'promptLibraryCollections'/);
assert.match(collections, /section\.id = PANEL_ID/);
assert.match(revisions, /PANEL_ID = 'promptLibraryRevisions'/);
assert.match(revisions, /section\.id = PANEL_ID/);
assert.match(collections, /aria-labelledby/);
assert.match(revisions, /aria-labelledby/);
assert.match(collections, /aria-label/);
assert.match(revisions, /aria-label/);
assert.match(collections, /aria-expanded/);
assert.match(revisions, /aria-expanded/);
assert.match(collections, /role', 'list'/);
assert.match(revisions, /role', 'list'/);
assert.match(css, /@media\(max-width:700px\)/);
assert.match(css, /forced-colors:active/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(collectionEnh, /aria-label/);
assert.match(revisionEnh, /aria-label/);
assert.match(collectionEnh, /beforeunload/);
assert.match(revisionEnh, /beforeunload/);
for (const source of [collections, revisions, collectionEnh, revisionEnh]) {
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /document\.write/);
  assert.doesNotMatch(source, /eval\(/);
  assert.doesNotMatch(source, /Function\(/);
}
console.log('prompt library collections/revisions UI contract: ok');
