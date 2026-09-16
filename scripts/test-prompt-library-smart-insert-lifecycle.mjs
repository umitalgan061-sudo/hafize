import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
for (const path of [
  'public/prompt-library-smart-insert.js',
  'public/prompt-library-smart-insert-center.js',
  'public/prompt-library-smart-insert-history.js',
  'public/prompt-library-smart-insert-history-bridge.js',
  'public/prompt-library-smart-insert-suggestions.js',
  'public/prompt-library-smart-insert-shortcuts.js',
  'public/prompt-library-smart-insert-presets.js',
  'public/prompt-library-smart-insert-validation.js',
  'public/prompt-library-smart-insert-activity.js'
]) {
  const source = await readFile(new URL(path, root), 'utf8');
  assert.match(source, /typeof globalThis !== 'undefined'/, `${path} uses stable global resolution`);
  assert.doesNotMatch(source, /setInterval\s*\(/, `${path} has no polling timer`);
  assert.doesNotMatch(source, /while\s*\(\s*true\s*\)/, `${path} has no unbounded loop`);
}
const center = await readFile(new URL('public/prompt-library-smart-insert-center.js', root), 'utf8');
assert.match(center, /addEventListener\(['"]hafize:prompt-library-variable-profiles-changed/);
assert.match(center, /beforeunload/);
const history = await readFile(new URL('public/prompt-library-smart-insert-history.js', root), 'utf8');
assert.match(history, /removeEventListener/);
const shortcuts = await readFile(new URL('public/prompt-library-smart-insert-shortcuts.js', root), 'utf8');
assert.match(shortcuts, /removeEventListener/);
console.log('prompt-library-smart-insert-lifecycle: ok');
