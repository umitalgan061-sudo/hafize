import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/prompt-library-smart-insert-presets.js', import.meta.url), 'utf8');
assert.match(source, /PRESET_KEY/); assert.match(source, /MAX_PRESETS\s*=\s*32/); assert.match(source, /MAX_VALUES\s*=\s*12/); assert.match(source, /MAX_VALUE\s*=\s*1000/);
assert.match(source, /normalizePreset/); assert.match(source, /normalizePresets/); assert.match(source, /upsert/); assert.match(source, /remove/); assert.match(source, /favorite/); assert.match(source, /search/);
assert.match(source, /valuesForPreset/); assert.match(source, /diffMissing/); assert.match(source, /exportText/); assert.match(source, /importText/); assert.match(source, /renderPicker/);
assert.match(source, /300000/); assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket/); assert.doesNotMatch(source, /innerHTML\s*=/);
console.log('prompt-library-smart-insert-presets: ok');
