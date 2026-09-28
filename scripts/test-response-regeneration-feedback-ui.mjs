import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(s,/👍/);
assert.match(s,/👎/);
assert.match(s,/aria-pressed/);
assert.match(s,/setAssistantFeedback/);
console.log('response feedback ui contract ok');