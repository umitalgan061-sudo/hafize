import assert from 'node:assert/strict';
const s=require('node:fs').readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/lineageOf/);
assert.match(s,/descendantCount/);
assert.match(s,/conversation-fork-lineage/);
assert.match(s,/Seviye/);
console.log('conversation fork lineage: ok');