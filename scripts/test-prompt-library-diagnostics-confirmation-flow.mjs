import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
for(const phrase of ['Güvenli biçimde onarılsın mı?','geçersiz kayıt karantinaya alınsın mı?','Karantinadaki geçersiz kayıtlar yeniden']) assert.ok(source.includes(phrase));
console.log('prompt-library-diagnostics-confirmation-flow: ok');
