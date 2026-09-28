import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(source,/setAssistantFeedback/);
assert.match(source,/aria-pressed/);
assert.match(source,/positive/);
assert.match(source,/negative/);
assert.match(source,/delete message\.feedback/);
console.log('response feedback contract ok');