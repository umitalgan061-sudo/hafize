import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';
const root = process.cwd();
const index = fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw = fs.readFileSync(path.join(root,'public/sw-policy.js'),'utf8');
const smart = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill.ts'),'utf8');
const hints = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill-hints.ts'),'utf8');
const palette = fs.readFileSync(path.join(root,'public/prompt-library-command-palette.ts'),'utf8');
for (const asset of ['prompt-library-smart-fill.css','prompt-library-command-palette.css','prompt-library-smart-fill.js','prompt-library-command-palette.js','prompt-library-smart-fill-hints.js']) assert.match(index,
  new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assertVersionedCacheDeclaration(sw);
for (const asset of ['prompt-library-smart-fill.css','prompt-library-command-palette.css','prompt-library-smart-fill.js','prompt-library-command-palette.js','prompt-library-smart-fill-hints.js']) assert.match(sw,
  new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);
assert.match(smart,/destroy: \(\) =>/);
assert.match(hints,/disconnect\(\)/);
assert.match(palette,/destroy: \(\) =>/);
console.log('prompt smart-fill release wiring: ok');
