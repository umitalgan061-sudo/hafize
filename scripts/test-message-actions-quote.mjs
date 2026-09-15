import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-actions.js', import.meta.url), 'utf8');
assert.ok(file.includes('function quote(article)'));
assert.ok(file.includes('split(\'\\n\').map((line) => `> ${line}`)'));
assert.ok(file.includes('composer.value'));
assert.ok(file.includes('slice(0, 12000)'));
assert.ok(file.includes('composer.dispatchEvent(new Event(\'input\''));
assert.ok(file.includes('Alıntıla'));
assert.ok(file.includes('Yanıt composer alanına alıntılandı.'));
console.log('assistant quote action contract ok');
