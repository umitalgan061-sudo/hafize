import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
for(const token of ['function surfaceSummary(surface)','data-privacy-copy-surface','surfaceSummary(surface)','Yüzey özeti panoya kopyalandı.']) assert.ok(s.includes(token),token);
assert.ok(!s.includes('copySurface.dataset.privacyCopySurface = raw'));
console.log('surface copy contract ok');
