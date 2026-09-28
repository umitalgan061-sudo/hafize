import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(source,/conversation\.messages\.slice\(0, index\)/);
assert.match(source,/conversation\.toolsEnabled \? '\/api\/agent\/run' : '\/api\/chat'/);
assert.doesNotMatch(source,/message\.alternates[^\n]*getRequestMessages/);
console.log('request boundary contract ok');