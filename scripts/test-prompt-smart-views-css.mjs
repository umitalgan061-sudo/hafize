import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const path of [
  'public/prompt-library-smart-views.css',
  'public/prompt-library-smart-views-extras.css'
]) {
  const source = fs.readFileSync(path,'utf8');
  assert.match(source,/max-width:700px/);
  assert.match(source,/prefers-reduced-motion:reduce/);
  assert.match(source,/forced-colors:active/);
  assert.match(source,/focus-visible/);
}
console.log('smart-view style contract: ok');