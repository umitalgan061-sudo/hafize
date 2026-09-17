import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');
const extra = await readFile(path.join(root, 'public', 'prompt-library-health-enhancements.js'), 'utf8');

assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /WebSocket/);
assert.doesNotMatch(extra, /fetch\s*\(/);
assert.doesNotMatch(extra, /XMLHttpRequest/);
assert.doesNotMatch(extra, /WebSocket/);
assert.match(source, /textContent/);
assert.match(source, /createElement\(/);
assert.match(source, /confirm\?\./);
assert.match(extra, /Blob/);
assert.match(extra, /createObjectURL/);
assert.match(extra, /revokeObjectURL/);
assert.match(extra, /MAX_EXPORT\s*=\s*900000/);
assert.match(source, /MAX_REPORT\s*=\s*240000/);
assert.doesNotMatch(source, /innerHTML/);
assert.doesNotMatch(extra, /innerHTML/);
console.log('prompt library health security: ok');
