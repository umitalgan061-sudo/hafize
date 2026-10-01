
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/settings-privacy.js','utf8');
for (const token of ['clearSurface(id, storage)','clearByGroup(group, storage)','clearAllKnown(storage)','surfaceMap.get(id)','TEMIZLE']) assert.ok(source.includes(token),token);
assert.ok(!source.includes('localStorage.clear('));
assert.ok(source.includes('group === group'));
console.log('privacy clear contract ok');
