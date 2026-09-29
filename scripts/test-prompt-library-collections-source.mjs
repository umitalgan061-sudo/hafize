import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');

assert.match(source, /localStorage/);
assert.match(source, /hafize\.prompt-library\.collections\.v1/);
assert.match(source, /hafize\.prompt-library\.collections\.map\.v1/);
assert.match(source, /hafize\.prompt-library\.collections\.default\.v1/);
assert.match(source, /MutationObserver/);
assert.match(source, /textContent/);
assert.match(source, /replaceChildren/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
console.log('prompt library collections source contract: ok');
