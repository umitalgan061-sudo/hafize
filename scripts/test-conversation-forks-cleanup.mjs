import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/conversation-forks.ts','utf8');
assert.match(s,/beforeunload/); assert.match(s,/removeEventListener/); assert.match(s,/observer\?\.disconnect/);
console.log('conversation fork cleanup: ok');