import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const core = await readFile(new URL('public/prompt-library-smart-insert.js', root), 'utf8');
const center = await readFile(new URL('public/prompt-library-smart-insert-center.js', root), 'utf8');
const history = await readFile(new URL('public/prompt-library-smart-insert-history.js', root), 'utf8');
const presets = await readFile(new URL('public/prompt-library-smart-insert-presets.js', root), 'utf8');
const activity = await readFile(new URL('public/prompt-library-smart-insert-activity.js', root), 'utf8');
// Çekirdek akıllı ekleme modülü kendi sabitlerini tanımlar; istem gövdesi
// sınırı önizleme sınırı olarak uygulanır.
assert.match(core, /MAX_PREVIEW\s*=\s*8000/); assert.match(core, /MAX_VARIABLES\s*=\s*12/); assert.match(core, /MAX_VALUE\s*=\s*1000/);
assert.match(center, /MAX_PROFILES\s*=\s*24/); assert.match(center, /MAX_PROFILE_NAME\s*=\s*60/); assert.match(center, /MAX_VARIABLES\s*=\s*12/); assert.match(center, /MAX_VALUE\s*=\s*1000/);
assert.match(history, /MAX_ENTRIES\s*=\s*40/); assert.match(history, /MAX_ID\s*=\s*120/); assert.match(history, /MAX_LABEL\s*=\s*100/);
assert.match(presets, /MAX_PRESETS\s*=\s*32/); assert.match(presets, /MAX_VALUES\s*=\s*12/); assert.match(presets, /MAX_VALUE\s*=\s*1000/);
assert.match(activity, /MAX_DAYS\s*=\s*14/); assert.match(activity, /MAX_ROWS\s*=\s*7/);
assert.doesNotMatch(center, /\.slice\(0,\s*9999999\)/); assert.doesNotMatch(history, /\.slice\(0,\s*9999999\)/);
console.log('prompt-library-smart-insert-bounds: ok');
