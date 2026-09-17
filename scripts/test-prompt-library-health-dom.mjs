import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');
const extra = await readFile(path.join(root, 'public', 'prompt-library-health-enhancements.js'), 'utf8');

assert.match(source, /documentRef\.createElement/);
assert.match(source, /textContent =/);
assert.match(source, /replaceChildren\(\)/);
assert.match(source, /setAttribute\('role', 'status'\)/);
assert.match(source, /setAttribute\('aria-live', 'polite'\)/);
assert.match(source, /setAttribute\('role', 'list'\)/);
assert.match(source, /setAttribute\('role', 'listitem'\)/);
assert.doesNotMatch(source, /\.outerHTML/);
assert.doesNotMatch(source, /insertAdjacentHTML/);
assert.doesNotMatch(source, /document\.write/);
assert.doesNotMatch(extra, /\.outerHTML/);
assert.doesNotMatch(extra, /insertAdjacentHTML/);
assert.match(extra, /createElement\('a'\)/);
console.log('prompt library health dom: ok');
