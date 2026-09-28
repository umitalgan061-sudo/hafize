import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('public/typed/app-shell.ts','utf8');
assert.match(source,/assistant-message-actions/);
assert.match(source,/Yeniden üret/);
assert.match(source,/Önceki yanıtı getir/);
assert.match(source,/Yanıt işlemleri/);
assert.match(source,/aria-label/);
console.log('response regeneration ui contract ok');