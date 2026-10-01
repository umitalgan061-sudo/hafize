import assert from 'node:assert/strict';
import fs from 'node:fs';
const s = fs.readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/lineageOf/);
assert.match(s,/descendantCount/);
assert.match(s,/conversation-fork-lineage/);
assert.match(s,/Seviye/);
console.log('conversation fork lineage: ok');