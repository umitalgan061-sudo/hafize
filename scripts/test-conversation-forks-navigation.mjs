import assert from 'node:assert/strict';
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/Üst sohbet/);
assert.match(s,/Fork noktası/);
assert.match(s,/scrollIntoView/);
assert.match(s,/conversation-fork-crumb/);
console.log('conversation fork navigation: ok');