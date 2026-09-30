import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const css=await fs.readFile('public/prompt-library.css','utf8');
assert.match(css,/prompt-library-import-dialog/);
// The import dialog panel stays inside the viewport at both breakpoints:
// capped against `vh` on desktop and again in the bottom-sheet layout.
assert.match(css,/\.prompt-import-preview-panel\{[^}]*max-height:min\(\d+vh,\s*\d+px\)/);
assert.match(css,/prompt-import-preview-panel\{[^}]*max-height:\d+vh/);
assert.match(css,/forced-colors:active/);
assert.match(css,/prompt-library-diagnostics-report/);
console.log('prompt-library-import-css: ok');
