import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const center = await readFile(new URL('public/prompt-library-smart-insert-center.js', root), 'utf8');
const core = await readFile(new URL('public/prompt-library-smart-insert.js', root), 'utf8');
const presets = await readFile(new URL('public/prompt-library-smart-insert-presets.js', root), 'utf8');
const history = await readFile(new URL('public/prompt-library-smart-insert-history.js', root), 'utf8');
assert.match(center, /normalizeProfile/); assert.match(center, /normalizeProfiles/); assert.match(center, /MAX_PROFILES/); assert.match(center, /MAX_VALUE/);
assert.match(core, /normalizeProfile/); assert.match(core, /normalizeProfiles/); assert.match(core, /mergeProfiles/); assert.match(core, /MAX_IMPORT/);
assert.match(presets, /normalizePreset/); assert.match(presets, /normalizePresets/); assert.match(presets, /importText/);
assert.match(history, /normalizeEntry/); assert.match(history, /normalizeHistory/); assert.match(history, /MAX_ENTRIES/);
for (const source of [center, core, presets, history]) {
  assert.doesNotMatch(source, /document\.write\(/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.doesNotMatch(source, /eval\s*\(/);
}
console.log('prompt-library-smart-insert-migration: ok');
