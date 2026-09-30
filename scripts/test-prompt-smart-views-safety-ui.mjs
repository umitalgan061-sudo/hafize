import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('public/prompt-library-smart-views-safety.js','utf8');
assert.match(source,/Görünüm sağlığı/);
assert.match(source,/Güvenli onarım/);
assert.match(source,/Son onarımı geri al/);
assert.match(source,/aria-labelledby/);
assert.match(source,/aria-controls/);
assert.match(source,/aria-expanded/);
assert.match(source,/role', 'list'/);
console.log('smart-view safety ui: ok');