import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const files = [
  'public/prompt-library-smart-insert.js',
  'public/prompt-library-smart-insert-center.js',
  'public/prompt-library-smart-insert-history.js',
  'public/prompt-library-smart-insert-suggestions.js',
  'public/prompt-library-smart-insert-validation.js',
  'public/prompt-library-smart-insert-activity.js'
];
for (const path of files) {
  const source = await readFile(new URL(path, root), 'utf8');
  assert.match(source, /createElement/);
  assert.match(source, /textContent|\.value/);
  assert.doesNotMatch(source, /innerHTML\s*=|outerHTML\s*=/);
  assert.doesNotMatch(source, /document\.write/);
}
const smart = await readFile(new URL('public/prompt-library-smart-insert.js', root), 'utf8');
assert.match(smart, /aria-modal/); assert.match(smart, /aria-labelledby/); assert.match(smart, /aria-live|role.*dialog/);
assert.match(smart, /role/, 'smart insert exposes semantic roles');
const center = await readFile(new URL('public/prompt-library-smart-insert-center.js', root), 'utf8');
assert.match(center, /replaceChildren/); assert.match(center, /role', 'listitem/);
const history = await readFile(new URL('public/prompt-library-smart-insert-history.js', root), 'utf8');
assert.match(history, /setAttribute\('aria-labelledby'/); assert.match(history, /setAttribute\('role', 'list'/);
console.log('prompt-library-smart-insert-dom: ok');
