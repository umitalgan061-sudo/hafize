import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');

assert.match(source, /hafize\.prompt-library\.smart-fill\.v1/);
assert.match(source, /role', 'dialog'/);
assert.match(source, /aria-modal/);
assert.match(source, /replaceVariables/);
assert.match(source, /useCount/);
assert.match(source, /input', \{ bubbles: true \}/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);

console.log('smart-fill source contract: ok');
