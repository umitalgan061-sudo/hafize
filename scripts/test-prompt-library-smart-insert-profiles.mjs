import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/prompt-library-smart-insert.js', root), 'utf8');
const center = await readFile(new URL('public/prompt-library-smart-insert-center.js', root), 'utf8');
const presets = await readFile(new URL('public/prompt-library-smart-insert-presets.js', root), 'utf8');
assert.match(source, /normalizeProfile\(/); assert.match(source, /normalizeProfiles\(/); assert.match(source, /MAX_PROFILES\s*=\s*24/); assert.match(source, /MAX_VARIABLES\s*=\s*12/); assert.match(source, /MAX_VALUE\s*=\s*1000/);
assert.match(center, /PROFILE_KEY/); assert.match(center, /MAX_PROFILES\s*=\s*24/); assert.match(center, /MAX_PROFILE_NAME\s*=\s*60/); assert.match(center, /keyForName/); assert.match(center,
  /Bu isimde bir profil zaten var/); assert.match(center, /favorite/); assert.match(center, /updatedAt/);
assert.match(center, /setAttribute\('aria-labelledby'/); assert.match(center, /setAttribute\('role', 'list'/); assert.match(center, /setAttribute\('role', 'listitem'/);
assert.match(presets, /MAX_PRESETS\s*=\s*32/); assert.match(presets, /normalizePreset\(/); assert.match(presets, /importText\(/); assert.match(presets, /exportText\(/); assert.match(presets, /300000/);
assert.doesNotMatch(center, /fetch\(|XMLHttpRequest|WebSocket/); assert.doesNotMatch(presets, /fetch\(|XMLHttpRequest|WebSocket/);
console.log('prompt-library-smart-insert-profiles: ok');
