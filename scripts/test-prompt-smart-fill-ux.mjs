import assert from 'node:assert/strict';
import fs from 'node:fs';

const fill = fs.readFileSync('public/prompt-library-fill.js', 'utf8');
const status = fs.readFileSync('public/prompt-library-fill-field-status.js', 'utf8');
const defaults = fs.readFileSync('public/prompt-library-fill-defaults.js', 'utf8');
const keyboard = fs.readFileSync('public/prompt-library-fill-keyboard.js', 'utf8');
const copy = fs.readFileSync('public/prompt-library-fill-copy.js', 'utf8');
const privacy = fs.readFileSync('public/prompt-library-fill-privacy.js', 'utf8');

assert.match(fill, /İstemi doldur/);
assert.match(fill, /Önizleme/);
assert.match(fill, /Mesaja aktar/);
assert.match(fill, /Dolu değerleri bu cihazda hatırla/);
assert.match(fill, /focus\(\)/);
assert.match(fill, /cancel/);
assert.match(fill, /preventDefault\(\)/);
assert.doesNotMatch(fill, /\.submit\(/);
assert.doesNotMatch(fill, /click\(\).*send/i);

assert.match(status, /aria-describedby/);
assert.match(status, /aria-live/);
assert.match(status, /0\/\$\{MAX_VALUE\}/);
assert.match(status, /alan dolu/);

assert.match(defaults, /Varsayılanları uygula/);
assert.match(defaults, /if \(!value \|\| input\.value\) return/);
assert.match(defaults, /Türkçe/);
assert.match(defaults, /profesyonel/);

assert.match(keyboard, /ctrlKey \|\| event\.metaKey/);
assert.match(keyboard, /shiftKey/);
assert.match(keyboard, /key\.toLowerCase\(\)/);
assert.match(keyboard, /enter/);
assert.match(keyboard, /'r'/);
assert.match(keyboard, /preventDefault\(\)/);

assert.match(copy, /clipboard/);
assert.match(copy, /Önizlemeyi kopyala/);
assert.match(copy, /Kopyalandı/);
assert.match(copy, /Kopyalanamadı/);

assert.match(privacy, /details/);
assert.match(privacy, /Yerel değerler/);
assert.match(privacy, /Tüm smart-fill verisini temizle/);
assert.match(privacy, /onay/);

console.log('smart fill UX contracts: ok');
