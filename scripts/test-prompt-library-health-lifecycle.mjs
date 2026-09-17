import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');

assert.match(source, /function mount\(/);
assert.match(source, /getElementById\(PANEL_ID\)/);
assert.match(source, /if \(!documentRef \|\| !card \|\| documentRef\.getElementById\(PANEL_ID\)\) return null/);
assert.match(source, /rootRef\.addEventListener\?\.\('storage', onStorage\)/);
assert.match(source, /removeEventListener\?\.\('storage', onStorage\)/);
assert.match(source, /panel\.remove\(\)/);
assert.match(source, /return Object\.freeze\(/);
assert.match(source, /mounted: true/);
assert.match(source, /refresh: render/);
assert.match(source, /destroy: \(\) =>/);
console.log('prompt library health lifecycle: ok');
