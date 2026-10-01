import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
const suspicious=['value:', 'raw,', 'item.body', 'item.messages', 'JSON.stringify(rootRef.localStorage'];
for(const token of suspicious) assert.ok(!s.includes(token),token);
assert.ok(s.includes('contentIncluded: false'));
assert.ok(s.includes('localOnly: true'));
console.log('privacy no-data-leak contract ok');
