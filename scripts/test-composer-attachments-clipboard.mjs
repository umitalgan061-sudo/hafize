import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/clipboardData\\?\\.files/);
assert.match(source,/if \\(!files\\.length\\) return/);
assert.match(source,/addFiles\\(files\\)/);
assert.match(source,/clipboard\\?\\.writeText/);
console.log('composer attachment clipboard: ok');