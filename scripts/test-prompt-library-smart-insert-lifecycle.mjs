import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
for (const path of [
  'public/typed/legacy/prompt-library-smart-insert.ts',
  'public/typed/legacy/prompt-library-smart-insert-center.ts',
  'public/typed/legacy/prompt-library-smart-insert-history.ts',
  'public/typed/legacy/prompt-library-smart-insert-history-bridge.ts',
  'public/typed/legacy/prompt-library-smart-insert-suggestions.ts',
  'public/typed/legacy/prompt-library-smart-insert-shortcuts.ts',
  'public/typed/legacy/prompt-library-smart-insert-presets.ts',
  'public/typed/legacy/prompt-library-smart-insert-validation.ts',
  'public/typed/legacy/prompt-library-smart-insert-activity.ts'
]) {
  const source = await readFile(new URL(path, root), 'utf8');
  assert.match(source, /typeof globalThis !== 'undefined'/, `${path} uses stable global resolution`);
  assert.doesNotMatch(source, /setInterval\s*\(/, `${path} has no polling timer`);
  assert.doesNotMatch(source, /while\s*\(\s*true\s*\)/, `${path} has no unbounded loop`);
}
const center = await readFile(new URL('public/typed/legacy/prompt-library-smart-insert-center.ts', root), 'utf8');
assert.match(center, /addEventListener\(['"]hafize:prompt-library-variable-profiles-changed/);
assert.match(center, /beforeunload/);
const history = await readFile(new URL('public/typed/legacy/prompt-library-smart-insert-history.ts', root), 'utf8');
assert.match(history, /removeEventListener/);
const shortcuts = await readFile(new URL('public/typed/legacy/prompt-library-smart-insert-shortcuts.ts', root), 'utf8');
assert.match(shortcuts, /removeEventListener/);
console.log('prompt-library-smart-insert-lifecycle: ok');
