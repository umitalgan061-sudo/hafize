import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/prompt-library-smart-fill.js', 'utf8');
const hints = await readFile('public/prompt-library-smart-fill-hints.js', 'utf8');

for (const code of [source, hints]) {
  assert.doesNotMatch(code, /fetch\s*\(/);
  assert.doesNotMatch(code, /XMLHttpRequest/);
  assert.doesNotMatch(code, /WebSocket/);
  assert.doesNotMatch(code, /navigator\.sendBeacon/);
  assert.doesNotMatch(code, /innerHTML/);
}

assert.match(source, /localStorage/);
assert.match(source, /hafize\.prompt-library\.smart-fill\.v1/);

console.log('smart-fill privacy boundary: ok');
