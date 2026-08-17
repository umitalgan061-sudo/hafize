import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/hands-free-consent.js', import.meta.url), 'utf8');
for (const phrase of [
  'yalnız bu oturumda',
  '“Hafize” uyandırma ifadesini dinler',
  'Dinleme görünür kalır',
  '30 dakika sonra kapanır',
  'otomatik gönderilmez',
  'Onayla ve dinlemeyi aç',
  'Vazgeç'
]) assert.ok(source.includes(phrase), `missing disclosure: ${phrase}`);
assert.doesNotMatch(source, /her zaman|süresiz|arka planda dinler/i);
console.log('hands-free consent copy contract tests passed');
