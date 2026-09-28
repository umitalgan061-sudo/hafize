import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-preview.js', import.meta.url), 'utf8');

assert.match(js, /Geçerli bir ajan seçmelisin/);
assert.match(js, /Görev metni boş olamaz/);
assert.match(js, /Çalıştırma zamanı seçilmelidir/);
assert.match(js, /Çalıştırma zamanı gelecekte olmalı/);
assert.match(js, /Math\.max\(1, Math\.min\(5/);
assert.match(js, /MAX_TASK = 20000/);
assert.match(js, /confirm\.disabled = errors\.length > 0/);
console.log('scheduled-task-preview-validation: ok');
