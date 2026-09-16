import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/prompt-library-smart-insert-suggestions.js', import.meta.url), 'utf8');
assert.match(source, /MAX_SUGGESTIONS\s*=\s*5/);
assert.match(source, /score\(/); assert.match(source, /rank\(/); assert.match(source, /recommend\(/);
assert.match(source, /fillValues\(/); assert.match(source, /hasMissing\(/); assert.match(source, /item\.variables/);
assert.match(source, /Object\.keys\(profile\.values/); assert.doesNotMatch(source, /profile\.values\[[^\]]+\].*textContent/);
assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket/);
console.log('prompt-library-smart-insert-suggestions: ok');
