import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');

assert.match(source, /HEALTH_STATE_KEY\s*=\s*'hafize\.prompt-library\.health\.v1'/);
assert.match(source, /filter: 'all', panelOpen: true/);
assert.match(source, /\['all', 'error', 'warning', 'info'\]/);
assert.match(source, /panelOpen: state\.panelOpen !== false/);
assert.match(source, /writeState\(rootRef/);
assert.match(source, /filter: next\.filter/);
assert.match(source, /panelOpen: next\.panelOpen/);
assert.doesNotMatch(source, /PROMPT_KEY.*health\.v1/);
console.log('prompt library health state: ok');
