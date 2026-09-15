import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');
const enhancements = await readFile(new URL('../public/scheduled-tasks-enhancements.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-tasks.css', import.meta.url), 'utf8');

assert.match(source, /Zamanlanmış görevler/);
assert.match(source, /Yeni görev planla/);
assert.match(source, /Görevi planla/);
assert.match(source, /İptal et/);
assert.match(source, /Planlandı/);
assert.match(source, /Çalışıyor/);
assert.match(source, /Tamamlandı/);
assert.match(source, /Başarısız/);
assert.match(source, /İptal edildi/);
assert.match(source, /datetime-local/);
assert.match(source, /maxAttempts/);
assert.match(source, /traceId/);
assert.match(enhancements, /Hızlı şablonlar/);
assert.match(enhancements, /Günlük özet/);
assert.match(enhancements, /Kod incelemesi/);
assert.match(enhancements, /Görevleri duruma göre filtrele|Görevleri duruma göre/);
assert.match(css, /max-width:650px/);
assert.match(css, /forced-colors:active/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion:reduce/);
console.log('scheduled task UI contract: ok');
