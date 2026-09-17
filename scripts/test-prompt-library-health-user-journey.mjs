import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const health = await readFile(path.join(root, 'public', 'prompt-library-health.js'), 'utf8');
const extra = await readFile(path.join(root, 'public', 'prompt-library-health-enhancements.js'), 'utf8');
const readme = await readFile(path.join(root, 'README.md'), 'utf8');

assert.match(readme, /Kütüphane Kalite Merkezi/);
assert.match(health, /Kütüphane kalite merkezi/);
assert.match(health, /Yeniden tara/);
assert.match(health, /Güvenli onarım/);
assert.match(health, /Raporu kopyala/);
assert.match(health, /Hatalar/);
assert.match(health, /Uyarılar/);
assert.match(health, /Bilgi/);
assert.match(extra, /Raporu indir/);
assert.match(extra, /Sorunlu promptları indir/);
assert.match(extra, /Yalnızca hata\/uyarı/);
assert.match(health, /Güvenli onarım/);
assert.match(health, /confirm\?\./);
console.log('prompt library health user journey: ok');
