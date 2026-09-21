import assert from 'node:assert/strict';
import fs from 'node:fs';
const c=fs.readFileSync('public/composer-attachments.css','utf8');
assert.match(c,/max-width:700px/);
assert.match(c,/grid-template-columns/);
assert.match(c,/flex-wrap/);
assert.match(c,/forced-colors:active/);
assert.match(c,/prefers-reduced-motion:reduce/);
console.log('attachment responsive styles: ok');