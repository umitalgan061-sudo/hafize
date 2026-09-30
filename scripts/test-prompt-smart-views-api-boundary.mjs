import assert from 'node:assert/strict';
import fs from 'node:fs';

for(const path of [
  'public/prompt-library-smart-views.js',
  'public/prompt-library-smart-views-history.js',
  'public/prompt-library-smart-views-builder.js',
  'public/prompt-library-smart-views-safety.js'
]){
  const source=fs.readFileSync(path,'utf8');
  assert.doesNotMatch(source,/\bfetch\s*\(/);
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
}
console.log('smart-view API boundary: ok');