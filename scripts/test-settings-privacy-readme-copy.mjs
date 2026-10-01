import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const r=readFileSync('README.md','utf8');
assert.ok(r.includes('Raporu kopyala') || r.includes('Özeti kopyala') || r.includes('Gizlilik raporu'));
console.log('privacy README copy contract ok');
