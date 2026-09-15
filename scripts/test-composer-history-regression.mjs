import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('public/composer-history.js', 'utf8');
assert.match(source, /mount: boot/);
assert.doesNotMatch(source, /HafizeComposerHistory\.mount\s*=/);
assert.match(source, /Object\.freeze\(\{/);
assert.match(source, /function boot\(/);
assert.match(source, /HafizeComposerHistoryController/);
console.log('composer history boot regression: ok');
