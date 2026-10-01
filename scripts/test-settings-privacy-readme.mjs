import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const r=readFileSync('README.md','utf8');
for(const token of ['Yerel Veri ve Gizlilik Merkezi','Tanınmayan localStorage','Gizlilik raporu','Veri yüzeylerini temizle','Bilinen tüm yerel veriyi temizle']) assert.ok(r.includes(token),token);
console.log('privacy README contract ok');
