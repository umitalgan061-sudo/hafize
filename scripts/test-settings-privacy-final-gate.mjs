import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
for(const token of ['HafizePrivacyCenter','SURFACES','inspectStorage','clearSurface','clearDataSurfaces','clearPreferences','clearAllKnown','privacySummary','privacyReport','surfaceSummary','mount']) assert.ok(s.includes(token),token);
assert.equal(s.includes('localStorage.clear('),false);
assert.equal(s.includes('fetch('),false);
assert.equal(s.includes('innerHTML ='),false);
console.log('privacy final gate ok');
