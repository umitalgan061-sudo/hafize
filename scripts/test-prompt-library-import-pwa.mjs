import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const [index, sw] = await Promise.all([
  fs.readFile('public/index.html', 'utf8'),
  fs.readFile('public/sw-policy.ts', 'utf8')
]);
for (const asset of ['typed-build/legacy-app.js','typed-build/legacy-app.js','typed-build/legacy-app.js']) {
  assert.match(index, new RegExp('/' + asset.replace('.', '\\.')));
  assert.match(sw, new RegExp('/' + asset.replace('.', '\\.'), 'g'));
}
console.log('prompt-library-import-pwa: ok');
