import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const smart = fs.readFileSync(path.join(root,'public/prompt-library-smart-fill.ts'),'utf8');
const palette = fs.readFileSync(path.join(root,'public/prompt-library-command-palette.ts'),'utf8');
const docs = fs.readFileSync(path.join(root,'docs/PROMPT_SMART_FILL_ACCEPTANCE.md'),'utf8');
const tokens = [
  'Kullan',
  'Mesaja aktar',
  'aria-modal',
  'aria-describedby',
  'MAX_VALUE',
  'MAX_VARIABLES',
  'MAX_PRESETS',
  'replaceVariables',
  'composer.value',
  'preventDefault'
];
for (const token of tokens) assert.match(smart,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
for (const token of ['/prompt','MAX_RESULTS','MAX_QUERY','ArrowDown','ArrowUp','Enter','Escape','HafizePromptLibrarySmartFill']) assert.match(palette,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(docs,/Kullanıcı akışı/);
assert.match(docs,/Erişilebilirlik/);
assert.match(docs,/Güvenlik/);
assert.match(docs,/PWA/);
console.log('prompt smart-fill acceptance: ok');
