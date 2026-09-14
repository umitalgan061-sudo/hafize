import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const smart = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill.js'),'utf8');
const palette = fs.readFileSync(path.join(root,'public/prompt-library-command-palette.js'),'utf8');
const hints = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill-hints.js'),'utf8');
const index = fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw = fs.readFileSync(path.join(root,'public/sw-policy.js'),'utf8');
for (const token of ['HafizePromptLibrarySmartFill','replaceVariables','Mesaja aktar','aria-modal']) assert.ok(smart.includes(token));
for (const token of ['PromptLibraryCommandPalette','/prompt','MAX_RESULTS = 12']) assert.ok(palette.includes(token));
for (const token of ['HafizePromptSmartFillHints','MutationObserver','MAX_VALUE = 1000']) assert.ok(hints.includes(token));
for (const asset of ['prompt-library-smart-fill.js','prompt-library-command-palette.js','prompt-library-smart-fill-hints.js']) {
  assert.ok(index.includes(asset));
  assert.ok(sw.includes(asset));
}
assert.ok(sw.includes('v29'));
assert.ok(sw.includes("pathname.startsWith('/api/')"));
console.log('prompt smart-fill final smoke: ok');
