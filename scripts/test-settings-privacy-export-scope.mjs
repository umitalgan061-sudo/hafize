import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
assert.ok(s.includes('surfaceSummary'));
assert.ok(s.includes('privacySummary'));
assert.ok(s.includes('privacyReport'));
assert.ok(s.includes('contentIncluded: false'));
console.log('privacy export scope ok');
