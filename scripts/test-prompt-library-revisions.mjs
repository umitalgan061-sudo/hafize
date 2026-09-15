import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');

assert.match(source, /hafize\.prompt-library\.revisions\.v1/);
assert.match(source, /MAX_REVISIONS = 10/);
assert.match(source, /function normalizeRevision/);
assert.match(source, /function normalizeStore/);
assert.match(source, /function capture/);
assert.match(source, /function restore/);
assert.match(source, /function exportPrompt/);
assert.match(source, /function mount/);
assert.doesNotMatch(source, /fetch\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
assert.match(source, /favorite: target\.favorite/);
assert.match(source, /useCount: target\.useCount/);
assert.match(source, /savedAt/);
assert.match(source, /reason === 'manual'/);
assert.match(source, /before-edit/);
assert.match(source, /textContent/);
assert.match(source, /aria-modal/);
assert.match(source, /Escape/);
assert.match(source, /prompt-item-actions/);
assert.match(source, /data-prompt-revision-action/);
console.log('prompt revision core contract: ok');
