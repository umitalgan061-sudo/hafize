import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
assert.match(source,/aria-live', 'polite'/);
assert.match(source,/aria-expanded/);
assert.match(source,/aria-controls/);
console.log('prompt-library-repair-preview-accessibility: ok');
