import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const path of [
  'public/typed/legacy/prompt-library-smart-views.ts',
  'public/typed/legacy/prompt-library-smart-views-history.ts',
  'public/typed/legacy/prompt-library-smart-views-builder.ts'
]) {
  const source = fs.readFileSync(path,'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
  assert.doesNotMatch(source,/eval\s*\(/);
  assert.match(source,/textContent/);
}
console.log('smart-view security boundary: ok');