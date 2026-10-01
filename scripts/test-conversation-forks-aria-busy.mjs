import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/setAttribute\('aria-busy', String\(isStreaming\)\)/);
assert.match(s,/setAttribute\('aria-busy', String\(disabled\)\)/);
console.log('conversation fork streaming accessibility contract: ok');