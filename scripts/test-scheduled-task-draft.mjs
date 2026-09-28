import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-draft.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-draft.css', import.meta.url), 'utf8');

assert.match(js, /hafize\.scheduled-task-draft\.v1/);
assert.match(js, /MAX_AGE_MS/);
assert.match(js, /readDraft/);
assert.match(js, /saveDraft/);
assert.match(js, /restoreDraft/);
assert.match(js, /Taslağı kaydet/);
assert.match(js, /Taslağı geri yükle/);
assert.match(js, /Taslağı sil/);
assert.match(js, /metaKey/);
assert.match(js, /altKey/);
assert.doesNotMatch(js, /root\.fetch/);
assert.doesNotMatch(js, /Authorization/);
assert.match(css, /scheduled-task-draft-tools/);
console.log('scheduled-task-draft: ok');
