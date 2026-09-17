import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
const root = process.cwd();
const files = [
  'public/prompt-library-smart-fill.mts',
  'public/prompt-library-command-palette.mts',
  'public/prompt-library-smart-fill-hints.mts',
  'public/prompt-library-smart-fill.css',
  'public/prompt-library-command-palette.css'
];
for (const file of files) assert.ok(fs.statSync(path.join(root,file)).size > 0, `${file} empty`);
const index = fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw = fs.readFileSync(path.join(root,'public/sw-policy.js'),'utf8');
assert.equal((index.match(/prompt-library-smart-fill\.js/g) || []).length, 1);
assert.equal((index.match(/prompt-library-command-palette\.js/g) || []).length, 1);
assert.equal((index.match(/prompt-library-smart-fill-hints\.js/g) || []).length, 1);
assertVersionedCacheDeclaration(sw);
console.log('prompt smart-fill smoke gate: ok');
