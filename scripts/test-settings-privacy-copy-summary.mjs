import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
for(const token of ['function privacySummary(snapshot, estimate)','Özeti kopyala','contentIncluded: false','navigator?.clipboard?.writeText?.']) assert.ok(s.includes(token),token);
assert.ok(!s.includes('writeText?.(rootRef.localStorage'));
console.log('privacy copy summary contract ok');
