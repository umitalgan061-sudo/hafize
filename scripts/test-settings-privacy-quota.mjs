import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
for(const token of ['ratio = estimate.usage / estimate.quota','%90','%80','Depolama kotasının']) assert.ok(s.includes(token),token);
assert.ok(!s.includes('clearAllKnown(rootRef.localStorage)') || s.includes('function clearAllKnown'));
console.log('privacy quota warning contract ok');
