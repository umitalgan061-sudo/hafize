import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertLegacyModuleOrder } from './legacy-bundle-contract.mjs';

// The prompt library core is its own generated entry; the starter set,
// enhancements and keyboard layers ride in the unified legacy entry, and their
// evaluation order is the import order of that entry.
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
for (const name of ['/typed-build/prompt-library.js', '/typed-build/legacy-app.js']) {
  assert.equal((html.match(new RegExp(name.replaceAll('/', '\\/').replace('.js', '\\.js'), 'g')) || []).length, 1, name);
}
assert.ok(
  html.indexOf('/typed-build/prompt-library.js') < html.indexOf('/typed-build/legacy-app.js'),
  'the prompt library core is loaded before the legacy layers that extend it'
);
assertLegacyModuleOrder(['prompt-library-starters', 'prompt-library-enhancements', 'prompt-library-keyboard']);
console.log('test-prompt-library-composition: ok');
