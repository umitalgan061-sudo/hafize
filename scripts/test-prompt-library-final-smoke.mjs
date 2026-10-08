import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { assertLegacyModulesBundled } from './legacy-bundle-contract.mjs';
const [index,sw,safety,preview,diag]=await Promise.all([
  fs.readFile('public/index.html','utf8'),
  fs.readFile('public/sw-policy.ts','utf8'),
  fs.readFile('public/typed/legacy/prompt-library-safety.ts','utf8'),
  fs.readFile('public/typed/legacy/prompt-library-import-preview.ts','utf8'),
  fs.readFile('public/typed/legacy/prompt-library-diagnostics.ts','utf8')
]);
assertLegacyModulesBundled(['prompt-library-safety', 'prompt-library-import-preview', 'prompt-library-diagnostics']);
for(const source of [safety,preview,diag]){
  assert.doesNotMatch(source,/XMLHttpRequest/);
  assert.doesNotMatch(source,/WebSocket/);
}
assert.match(preview,/role', 'dialog'/);
assert.match(diag,/aria-expanded/);
console.log('prompt-library-final-smoke: ok');
