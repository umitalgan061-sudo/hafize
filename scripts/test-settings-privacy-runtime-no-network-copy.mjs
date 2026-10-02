import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
for(const token of ['fetch(','XMLHttpRequest','WebSocket']) assert.equal(s.includes(token),false,token);
assert.ok(s.includes('navigator?.clipboard?.writeText?.'));
console.log('privacy copy network boundary ok');
