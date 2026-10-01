import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
for(const token of ['data-privacy-clear','data-privacy-copy-surface','privacyDataOnlyPresent','privacy-data-filter-controls']) assert.ok(s.includes(token),token);
console.log('privacy final action surface gate ok');
