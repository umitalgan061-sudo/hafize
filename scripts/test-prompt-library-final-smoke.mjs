import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const [index,sw,safety,preview,diag]=await Promise.all([
  fs.readFile('public/index.html','utf8'),
  fs.readFile('public/sw-policy.js','utf8'),
  fs.readFile('public/prompt-library-safety.js','utf8'),
  fs.readFile('public/prompt-library-import-preview.js','utf8'),
  fs.readFile('public/prompt-library-diagnostics.js','utf8')
]);
for(const asset of ['prompt-library-safety.js','prompt-library-import-preview.js','prompt-library-diagnostics.js']){
  assert.ok(index.includes('/'+asset));
  assert.ok(sw.includes('/'+asset));
}
for(const source of [safety,preview,diag]){
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
}
assert.match(preview,/role', 'dialog'/);
assert.match(diag,/aria-expanded/);
console.log('prompt-library-final-smoke: ok');
