import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(source,/message\.content = previousContent/);
assert.match(source,/saveConversations\(\)/);
assert.match(source,/isStreaming/);
assert.match(source,/slice\(0, index\)/);
assert.doesNotMatch(source,/alternates.*getRequestMessages/);
console.log('response safety contract ok');