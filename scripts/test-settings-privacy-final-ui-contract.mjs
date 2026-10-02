import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
for(const token of ['privacyDataCenter','privacy-data-filter-controls','privacyDataOnlyPresent','data-privacy-clear','data-privacy-copy-surface','Gizlilik raporu','Özeti kopyala']) assert.ok(s.includes(token),token);
console.log('privacy UI final gate ok');
