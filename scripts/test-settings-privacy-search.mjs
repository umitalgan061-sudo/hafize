import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
for(const token of ['MAX_SEARCH','filter.type = \'search\'','Veri yüzeyi ara…','aria-label\', \'Yerel veri yüzeylerinde ara\'']) assert.ok(s.includes(token),token);
assert.match(s,/toLocaleLowerCase\('tr-TR'\)/);
console.log('privacy search contract ok');
