import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const control = await readFile(new URL('../public/typed/generation-control.ts', import.meta.url), 'utf8');
const history = await readFile(new URL('../public/typed/generation-history.ts', import.meta.url), 'utf8');

for (const source of [control, history]) {
  assert.doesNotMatch(source, /\b(innerHTML|outerHTML)\b/);
  assert.doesNotMatch(source, /\b(fetch|XMLHttpRequest|WebSocket)\s*\(/);
  assert.doesNotMatch(source, /Authorization\s*:/i);
}
assert.match(control, /navigator\.clipboard/);
assert.match(control, /String\(value \?\? ''\)/);
assert.match(history, /replace\(/\\u0000/g/);
assert.match(history, /GENERATION_HISTORY_MAX_JSON = 24_000/);
assert.match(history, /slice\(0, GENERATION_HISTORY_LIMIT \* 3\)/);
console.log('generation-control security: OK');
