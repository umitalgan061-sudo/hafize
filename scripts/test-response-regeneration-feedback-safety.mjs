import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(source,/message\.feedback = feedback/);
assert.match(source,/delete message\.feedback/);
assert.match(source,/feedback === 'positive' \|\| feedback === 'negative'/);
console.log('feedback safety contract ok');