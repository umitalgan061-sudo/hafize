import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
const root = process.cwd();
const sw = fs.readFileSync(path.join(root,'public/sw-policy.js'),'utf8');
const index = fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const assets = [
  'prompt-library-smart-fill.css',
  'prompt-library-smart-fill.js',
  'prompt-library-command-palette.css',
  'prompt-library-command-palette.js',
  'prompt-library-smart-fill-hints.js'
];
for (const asset of assets) {
  assert.match(index,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(sw,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
}
assertVersionedCacheDeclaration(sw);
assert.match(sw,/new Set\(SHELL_ASSETS\)/);
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
assert.match(sw,/return 'network-only'/);
assert.match(sw,/return 'shell'/);
assert.match(sw,/shouldDeleteCache/);
assert.doesNotMatch(sw,/HafizePromptLibrary/);
console.log('prompt smart-fill PWA policy: ok');
