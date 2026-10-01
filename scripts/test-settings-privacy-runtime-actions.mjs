import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync('public/settings-privacy.js','utf8');
for(const token of ['Veri yüzeylerini temizle','Tercihleri sıfırla','Bilinen tüm yerel veriyi temizle','Raporu kopyala','Özeti kopyala']) assert.ok(s.includes(token),token);
console.log('privacy actions contract ok');
