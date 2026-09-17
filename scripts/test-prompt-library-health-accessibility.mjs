import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');
const css = await readFile(path.join(root, 'public', 'prompt-library-health.css'), 'utf8');

assert.match(source, /aria-labelledby/);
assert.match(source, /aria-expanded/);
assert.match(source, /role', 'status'/);
assert.match(source, /aria-live', 'polite'/);
assert.match(source, /role', 'list'/);
assert.match(source, /role', 'listitem'/);
assert.match(source, /setAttribute\('aria-label'/);
assert.match(source, /button\(documentRef, 'Güvenli onarım'/);
assert.match(css, /focus-visible/);
assert.match(css, /forced-colors:active/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(css, /max-width:700px/);
console.log('prompt library health accessibility: ok');
