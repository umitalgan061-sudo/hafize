import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/typed/settings-privacy.ts','utf8');
assert.ok(s.includes('clearSurface'));
assert.ok(s.includes("clearByGroup('data'"));
assert.ok(s.includes("clearByGroup('preference'"));
assert.ok(s.includes('clearAllKnown'));
console.log('privacy clear scope ok');
