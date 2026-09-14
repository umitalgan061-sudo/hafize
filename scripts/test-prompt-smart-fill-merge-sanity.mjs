import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const index = fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw = fs.readFileSync(path.join(root,'public/sw-policy.js'),'utf8');
const smart = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill.js'),'utf8');
const palette = fs.readFileSync(path.join(root,'public/prompt-library-command-palette.js'),'utf8');
const hints = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill-hints.js'),'utf8');
assert.ok(index.includes('/prompt-library-smart-fill.js'));
assert.ok(index.includes('/prompt-library-command-palette.js'));
assert.ok(index.includes('/prompt-library-smart-fill-hints.js'));
assert.ok(sw.includes('v29'));
assert.ok(sw.includes('/prompt-library-smart-fill.js'));
assert.ok(sw.includes('/prompt-library-command-palette.js'));
assert.ok(sw.includes('/prompt-library-smart-fill-hints.js'));
assert.ok(smart.includes('Mesaja aktar'));
assert.ok(smart.includes('replaceVariables'));
assert.ok(smart.includes('aria-modal'));
assert.ok(palette.includes('/prompt'));
assert.ok(palette.includes('MAX_RESULTS = 12'));
assert.ok(hints.includes('MutationObserver'));
for (const source of [smart,palette,hints]) {
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('XMLHttpRequest'));
  assert.ok(!source.includes('WebSocket'));
  assert.ok(!source.includes('innerHTML ='));
}
console.log('prompt smart-fill merge sanity: ok');
