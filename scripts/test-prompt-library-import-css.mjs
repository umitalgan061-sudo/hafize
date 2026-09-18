import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const css=await fs.readFile('public/prompt-library.css','utf8');
assert.match(css,/prompt-library-import-dialog/);
assert.match(css,/max-height:min\(88vh/);
assert.match(css,/forced-colors:active/);
assert.match(css,/prompt-library-diagnostics-report/);
console.log('prompt-library-import-css: ok');
