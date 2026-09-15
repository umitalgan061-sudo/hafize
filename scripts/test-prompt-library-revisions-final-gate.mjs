import assert from 'node:assert/strict';
import fs from 'node:fs';

const revision = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
const checkpoint = fs.readFileSync('public/prompt-library-revision-checkpoint.js', 'utf8');
const css = fs.readFileSync('public/prompt-library.css', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');
const docs = fs.readFileSync('docs/PROMPT_LIBRARY_REVISIONS_FINAL_CHECK.md', 'utf8');

assert.match(revision, /hafize\.prompt-library\.revisions\.v1/);
assert.match(revision, /MAX_REVISIONS = 10/);
assert.match(revision, /MAX_BODY = 8000/);
assert.match(revision, /function capture/);
assert.match(revision, /function restore/);
assert.match(revision, /function exportPrompt/);
assert.match(revision, /function showComparison/);
assert.match(revision, /function closePanel/);
assert.match(revision, /keydownHandler/);
assert.match(revision, /storageHandler/);
assert.match(revision, /removeEventListener\('keydown', keydownHandler\)/);
assert.match(revision, /removeEventListener\?\.\('storage', storageHandler\)/);
assert.match(revision, /favorite: target\.favorite/);
assert.match(revision, /useCount: target\.useCount/);
assert.match(revision, /createdAt: target\.createdAt/);
assert.match(revision, /capture\(activePrompt, 'manual'\)/);
assert.doesNotMatch(revision, /innerHTML/);
assert.doesNotMatch(revision, /outerHTML/);
assert.doesNotMatch(revision, /fetch\s*\(/);
assert.doesNotMatch(revision, /XMLHttpRequest/);
assert.doesNotMatch(revision, /WebSocket/);

assert.match(checkpoint, /Sürümü koru/);
assert.match(checkpoint, /api\.capture\(item, 'manual'\)/);
assert.match(checkpoint, /beforeunload/);
assert.doesNotMatch(checkpoint, /fetch\s*\(/);

assert.match(css, /prompt-revision-panel/);
assert.match(css, /prompt-revision-comparison-grid/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);

assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v32`/);
assert.match(sw, /\/prompt-library-revisions\.js/);
assert.match(sw, /\/prompt-library-revision-checkpoint\.js/);

assert.match(docs, /Acceptance/);
assert.match(docs, /Rollback/);
assert.match(docs, /Privacy/);

console.log('prompt revision final release gate: ok');
