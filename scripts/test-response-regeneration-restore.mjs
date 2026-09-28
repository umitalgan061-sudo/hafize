import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/restoreLatestResponseAlternate/);
assert.match(s,/message\.content = rotated\.current/);
assert.match(s,/message\.alternates = rotated\.alternates/);
console.log('response restore contract ok');