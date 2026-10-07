import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertNumericLimit } from './source-contract.mjs';
const source = await readFile(new URL('../public/typed/legacy/prompt-library-smart-insert-presets.ts', import.meta.url), 'utf8');
assert.match(source, /PRESET_KEY/); assertNumericLimit(source, 'MAX_PRESETS', 32); assertNumericLimit(source, 'MAX_VALUES', 12); assertNumericLimit(source, 'MAX_VALUE', 1000);
assert.match(source, /normalizePreset/); assert.match(source, /normalizePresets/); assert.match(source, /upsert/); assert.match(source, /remove/); assert.match(source, /favorite/); assert.match(source, /search/);
assert.match(source, /valuesForPreset/); assert.match(source, /diffMissing/); assert.match(source, /exportText/); assert.match(source, /importText/); assert.match(source, /renderPicker/);
assert.match(source, /300000/); assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket/); assert.doesNotMatch(source, /innerHTML\s*=/);
console.log('prompt-library-smart-insert-presets: ok');
