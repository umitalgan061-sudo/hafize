import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const text = fs.readFileSync(path.join(process.cwd(), 'public/prompt-library-command-palette.ts'), 'utf8');
const tokens = [
  'PromptLibraryCommandPalette',
  'MAX_RESULTS = 12',
  'MAX_QUERY = 120',
  'score(item, normalized)',
  'searchPromptLibrary(query: string)',
  'role',
  'listbox',
  'aria-selected',
  'ArrowDown',
  'ArrowUp',
  'Escape',
  'Enter'
];
for (const token of tokens) assert.match(text, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(text, /\/prompt/);
assert.match(text, /HafizePromptLibrarySmartFill/);
assert.doesNotMatch(text, /fetch\(/);
assert.doesNotMatch(text, /XMLHttpRequest/);
console.log('prompt command palette source: ok');
