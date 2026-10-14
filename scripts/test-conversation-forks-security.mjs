import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/conversation-forks.ts','utf8');
for(const token of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'innerHTML =', 'outerHTML =']) assert.equal(s.includes(token),false,token);
assert.match(s,/textContent/);
assert.match(s,/localStorage/);
console.log('conversation fork security boundary: ok');