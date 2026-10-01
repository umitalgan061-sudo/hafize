import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
assert.ok(s.includes('clearPreferences'));
assert.ok(s.includes("clearByGroup('preference'"));
assert.ok(s.includes('Tercihleri sıfırla'));
assert.ok(s.includes('Kullanıcı verileri korunur.'));
console.log('privacy preferences contract ok');
