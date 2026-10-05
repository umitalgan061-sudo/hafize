import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('../', import.meta.url).pathname);
const read = (path) => readFile(resolve(root, path), 'utf8');
const names = ['prompt-library-smart-insert','prompt-library-smart-insert-center','prompt-library-smart-insert-activity','prompt-library-smart-insert-history-bridge','prompt-library-smart-insert-shortcuts'];
const domBuilders = new Set(['prompt-library-smart-insert','prompt-library-smart-insert-center','prompt-library-smart-insert-activity']);
for (const name of names) {
  const source = await read('public/typed/legacy/' + name + '.ts');
  if (domBuilders.has(name)) assert.match(source, /createElement/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
  assert.doesNotMatch(source, /outerHTML/);
  assert.doesNotMatch(source, /insertAdjacentHTML/);
  assert.doesNotMatch(source, /document\.write/);
  assert.doesNotMatch(source, /eval\s*\(/);
  assert.doesNotMatch(source, /Function\s*\(/);
  if (domBuilders.has(name)) assert.match(source, /textContent/);
}
const main = await read('public/typed/legacy/prompt-library-smart-insert.ts');
assert.match(main, /MAX_VARIABLES = 12/);
assert.match(main, /MAX_VALUE = 1000/);
assert.match(main, /MAX_PREVIEW = 8000/);
assert.match(main, /MAX_IMPORT = 300000/);
assert.match(main, /aria-/);
console.log('Smart Insert UI security boundary: OK');
