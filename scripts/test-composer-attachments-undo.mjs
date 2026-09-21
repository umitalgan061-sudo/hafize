import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('public/composer-attachments.js','utf8');
assert.match(source,/lastInsertion/);
assert.match(source,/const onUndo/);
assert.match(source,/lastInsertion = null/);
assert.match(source,/Son dosya eklemesi geri alındı/);
console.log('composer attachment undo: ok');