import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-command-palette.js'), 'utf8');
for (const token of ['PromptLibraryCommandPalette','MAX_RESULTS = 12','MAX_QUERY = 120','score(item, query)','results(query)','role','listbox','aria-selected','ArrowDown','ArrowUp','Escape','Enter']) assert.match(text,
  new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(text, /\/prompt/);
assert.match(text, /HafizePromptLibrarySmartFill/);
assert.doesNotMatch(text, /fetch\(/);
assert.doesNotMatch(text, /XMLHttpRequest/);
console.log('prompt command palette source: ok');
